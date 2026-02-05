
import { read, utils } from 'xlsx';
import { Trade, TradeDirection, Lot, ClosedTrade, CalculationResult, FeeRecord } from './types';

export class ProfitCalculator {
    trades: Trade[] = [];
    fees: FeeRecord[] = [];

    // Helper to parse dates like "DD.MM.YYYY" or standard JS dates
    private parseDate(dateVal: any): Date {
        if (dateVal instanceof Date) return dateVal;
        if (typeof dateVal === 'string') {
            // Assume DD.MM.YYYY which is common in Freedom24
            const parts = dateVal.split('.');
            if (parts.length === 3) {
                return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
            }
            return new Date(dateVal);
        }
        // Excel serial date?
        if (typeof dateVal === 'number') {
            return new Date((dateVal - (25567 + 2)) * 86400 * 1000);
        }
        return new Date();
    }

    async loadTrades(fileBuffer: ArrayBuffer) {
        const wb = read(fileBuffer, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]]; // Assume first sheet
        const data: any[] = utils.sheet_to_json(ws);

        this.trades = [];

        for (const row of data) {
            // Basic validation
            if (!row['Ticker'] && !row['Symbol']) continue;

            const ticker = row['Ticker'] || row['Symbol'];
            const dateVal = row['Date'];
            const qty = Math.abs(parseFloat(row['Quantity'] || row['Qty'] || '0'));
            const price = parseFloat(row['Price'] || '0');
            const fee = Math.abs(parseFloat(row['Fee'] || row['Commission'] || '0'));
            const amount = Math.abs(parseFloat(row['Amount'] || '0'));

            let direction = TradeDirection.BUY;
            const dirStr = String(row['Direction'] || '').toLowerCase();
            if (dirStr.includes('sell')) direction = TradeDirection.SELL;

            this.trades.push({
                date: this.parseDate(dateVal),
                ticker: String(ticker),
                direction,
                quantity: qty,
                price: price,
                fee: fee,
                amount: amount,
                datetime_str: String(dateVal)
            });
        }

        // Sort by date
        this.trades.sort((a, b) => a.date.getTime() - b.date.getTime());
    }

    async loadFees(fileBuffer: ArrayBuffer) {
        const wb = read(fileBuffer, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data: any[] = utils.sheet_to_json(ws);

        this.fees = [];

        for (const row of data) {
            const amount = parseFloat(row['Amount'] || '0');
            const dirStr = String(row['Direction'] || '').toLowerCase();

            // In Freedom24, "Trading fee" with a negative amount is a cost.
            // We only care about costs for now
            if (dirStr.includes('trading fee') || dirStr.includes('commission')) {
                this.fees.push({
                    date: this.parseDate(row['Date']),
                    description: row['Comment'] || row['Direction'],
                    amount: amount,
                    currency: row['Currency']
                });
            }
        }
    }

    calculate(method: 'FIFO' | 'AVG' = 'FIFO'): CalculationResult {
        const closedTrades: ClosedTrade[] = [];
        const openPositions: Record<string, Lot[]> = {};

        // Group by ticker
        const tradesByTicker: Record<string, Trade[]> = {};
        for (const t of this.trades) {
            if (!tradesByTicker[t.ticker]) tradesByTicker[t.ticker] = [];
            tradesByTicker[t.ticker].push(t);
        }

        for (const ticker in tradesByTicker) {
            const tickerTrades = tradesByTicker[ticker];
            const ledger: Lot[] = [];

            for (const trade of tickerTrades) {
                if (trade.direction === TradeDirection.BUY) {
                    // Avg cost per share for this lot
                    const unitCost = (trade.price * trade.quantity + trade.fee) / trade.quantity;
                    ledger.push({
                        date: trade.date,
                        quantity: trade.quantity,
                        unit_cost: unitCost,
                        price_paid: trade.price * trade.quantity,
                        fees_paid: trade.fee
                    });
                } else if (trade.direction === TradeDirection.SELL) {
                    let qtyToSell = trade.quantity;
                    let costBasis = 0;

                    if (method === 'FIFO') {
                        // Consume lots from the front
                        while (qtyToSell > 0 && ledger.length > 0) {
                            const head = ledger[0];
                            if (head.quantity <= qtyToSell) {
                                // Full lot consumed
                                costBasis += head.quantity * head.unit_cost;
                                qtyToSell -= head.quantity;
                                ledger.shift(); // Remove head
                            } else {
                                // Partial lot
                                costBasis += qtyToSell * head.unit_cost;
                                head.quantity -= qtyToSell;
                                qtyToSell = 0;
                            }
                        }
                    } else { // AVG
                        const totalQty = ledger.reduce((sum, l) => sum + l.quantity, 0);
                        const totalCost = ledger.reduce((sum, l) => sum + (l.quantity * l.unit_cost), 0);

                        if (totalQty > 0) {
                            const avgCost = totalCost / totalQty;
                            costBasis = qtyToSell * avgCost;

                            // Reduce all lots proportionally
                            const ratio = (totalQty - qtyToSell) / totalQty;
                            // Filter out tiny dust
                            const newLedger: Lot[] = [];
                            for (const lot of ledger) {
                                lot.quantity *= ratio;
                                if (lot.quantity > 1e-9) newLedger.push(lot);
                            }
                            // replace contents of ledger (casting/reassignment)
                            ledger.splice(0, ledger.length, ...newLedger);
                        }
                    }

                    const saleProceeds = (trade.price * trade.quantity) - trade.fee;
                    const realizedProfit = saleProceeds - costBasis;

                    closedTrades.push({
                        ticker,
                        date: trade.date,
                        quantity: trade.quantity,
                        sell_price: trade.price,
                        sell_fees: trade.fee,
                        cost_basis: costBasis,
                        realized_profit: realizedProfit,
                        sale_proceeds: saleProceeds,
                        method
                    });
                }
            }
            if (ledger.length > 0) {
                openPositions[ticker] = ledger;
            }
        }

        const totalRealized = closedTrades.reduce((sum, t) => sum + t.realized_profit, 0);
        // Fees are negative amounts in the file, so we sum them (resulting in negative total)
        // If we want "Total Fees Paid", we take absolute.
        // Net Profit = Realized + (Sum of Negative Fees)
        const standaloneFees = this.fees.reduce((sum, f) => sum + f.amount, 0);

        return {
            closed_trades: closedTrades,
            open_positions: openPositions,
            total_realized_profit: totalRealized,
            total_fees_paid: standaloneFees, // This is a negative number usually
            net_profit: totalRealized + standaloneFees
        };
    }
}
