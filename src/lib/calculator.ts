
import { read, utils } from 'xlsx';
import { Trade, TradeDirection, Lot, ClosedTrade, CalculationResult, FeeRecord, Dividend } from './types';

export class ProfitCalculator {
    trades: Trade[] = [];
    fees: FeeRecord[] = [];
    dividends: Dividend[] = [];

    private parseNumber(value: unknown): number {
        if (value === null || value === undefined) return 0;
        if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
        const raw = String(value).trim();
        if (!raw) return 0;

        let normalized = raw.replace(/\s+/g, '');
        const hasComma = normalized.includes(',');
        const hasDot = normalized.includes('.');
        if (hasComma && hasDot) {
            normalized = normalized.replace(/\./g, '').replace(',', '.');
        } else if (hasComma) {
            normalized = normalized.replace(',', '.');
        }
        normalized = normalized.replace(/[^0-9.-]/g, '');
        const num = Number(normalized);
        return Number.isFinite(num) ? num : 0;
    }

    private parseDate(dateVal: unknown): Date {
        if (dateVal instanceof Date && !Number.isNaN(dateVal.getTime())) return dateVal;
        if (typeof dateVal === 'number' && Number.isFinite(dateVal)) {
            return new Date((dateVal - 25569) * 86400 * 1000);
        }
        if (typeof dateVal === 'string') {
            const trimmed = dateVal.trim();
            if (!trimmed) return new Date();
            const [datePart, timePart] = trimmed.split(' ');
            const dot = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/;
            const slash = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
            const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
            let day: number | null = null;
            let month: number | null = null;
            let year: number | null = null;
            if (dot.test(datePart)) {
                const [, d, m, y] = datePart.match(dot) as RegExpMatchArray;
                day = parseInt(d, 10);
                month = parseInt(m, 10) - 1;
                year = parseInt(y, 10);
            } else if (slash.test(datePart)) {
                const [, d, m, y] = datePart.match(slash) as RegExpMatchArray;
                day = parseInt(d, 10);
                month = parseInt(m, 10) - 1;
                year = parseInt(y, 10);
            } else if (iso.test(datePart)) {
                const [, y, m, d] = datePart.match(iso) as RegExpMatchArray;
                day = parseInt(d, 10);
                month = parseInt(m, 10) - 1;
                year = parseInt(y, 10);
            }

            if (day !== null && month !== null && year !== null) {
                if (timePart) {
                    const [hh, mm] = timePart.split(':').map((v) => parseInt(v, 10));
                    return new Date(year, month, day, hh || 0, mm || 0);
                }
                return new Date(year, month, day);
            }

            const fallback = new Date(trimmed);
            if (!Number.isNaN(fallback.getTime())) return fallback;
        }
        return new Date();
    }

    private getValue(row: Record<string, any>, keys: string[]) {
        for (const key of keys) {
            const value = row[key];
            if (value !== undefined && value !== null && String(value).trim() !== '') {
                return value;
            }
        }
        return null;
    }

    private normalizeDirection(value: unknown): TradeDirection | null {
        const dir = String(value ?? '').trim().toLowerCase();
        if (!dir) return null;
        if (dir.startsWith('b') || dir.includes('buy')) return TradeDirection.BUY;
        if (dir.startsWith('s') || dir.includes('sell')) return TradeDirection.SELL;
        return null;
    }

    async loadTrades(fileBuffer: ArrayBuffer) {
        const wb = read(fileBuffer, { type: 'array', cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]]; // Assume first sheet
        const data: any[] = utils.sheet_to_json(ws, { defval: null });

        this.trades = [];

        for (const row of data) {
            const ticker = this.getValue(row, ['Ticker', 'Symbol', 'Instrument', 'Security', 'ISIN']);
            if (!ticker) continue;

            const dateVal = this.getValue(row, ['Date', 'Trade Date', 'Execution Date']);
            const rawQty = this.parseNumber(this.getValue(row, ['Quantity', 'Qty', 'Volume', 'Amount (shares)']));
            const rawAmount = this.parseNumber(this.getValue(row, ['Amount', 'Value', 'Total', 'Sum']));
            const rawPrice = this.parseNumber(this.getValue(row, ['Price', 'Price per share', 'Rate']));
            const rawFee = this.parseNumber(this.getValue(row, ['Fee', 'Commission', 'Commissions', 'Trading fee', 'Fee amount']));
            const directionValue = this.getValue(row, ['Direction', 'Type', 'Side', 'Action', 'Operation']);
            const direction = this.normalizeDirection(directionValue)
                ?? ((rawQty < 0 || rawAmount < 0) ? TradeDirection.SELL : TradeDirection.BUY);
            const currency = String(this.getValue(row, ['Currency', 'Curr']) ?? 'USD');

            const quantity = Math.abs(rawQty);
            const amount = Math.abs(rawAmount);
            let price = rawPrice;
            if (!price && quantity > 0 && amount > 0) {
                price = amount / quantity;
            }
            const fee = Math.abs(rawFee);

            if (!quantity || !price) continue;

            this.trades.push({
                date: this.parseDate(dateVal),
                ticker: String(ticker).trim(),
                direction,
                quantity,
                price,
                fee,
                amount: amount || price * quantity,
                currency,
                datetime_str: dateVal ? String(dateVal) : undefined,
            });
        }

        // Sort by date
        this.trades.sort((a, b) => a.date.getTime() - b.date.getTime());
    }

    async loadFees(fileBuffer: ArrayBuffer) {
        const wb = read(fileBuffer, { type: 'array', cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data: any[] = utils.sheet_to_json(ws, { defval: null });

        this.fees = [];
        this.dividends = [];

        for (const row of data) {
            const amountRaw = this.parseNumber(this.getValue(row, ['Amount', 'Value', 'Total', 'Sum']));
            const direction = String(this.getValue(row, ['Direction', 'Type', 'Operation', 'Action']) ?? '').toLowerCase();
            const comment = String(this.getValue(row, ['Comment', 'Description', 'Details']) ?? '');
            const currency = String(this.getValue(row, ['Currency']) ?? 'USD');

            // Check for Tax/Fee
            const isTax = direction.toLowerCase().includes('tax')
                || comment.toLowerCase().includes('tax')
                || direction.includes('fee')
                || direction.includes('commission')
                || comment.toLowerCase().includes('fee')
                || comment.toLowerCase().includes('commission');

            // Check for Dividend
            const isDividend = (direction.includes('dividend')
                || comment.toLowerCase().includes('dividend')
                || direction.includes('div')
                || comment.toLowerCase().includes('div payment'))
                && !isTax; // Exclude taxes from dividends

            if (isDividend) {
                const amount = Math.abs(amountRaw); // Dividends are income
                if (!amount) continue;

                this.dividends.push({
                    date: this.parseDate(this.getValue(row, ['Date'])),
                    description: comment || direction,
                    amount,
                    currency
                });
                continue; // Skip fee processing if it's a dividend
            }

            if (isTax) {
                const amount = Math.abs(amountRaw); // Fees are expenses
                if (!amount) continue;

                this.fees.push({
                    date: this.parseDate(this.getValue(row, ['Date'])),
                    description: comment || direction,
                    amount: amount, // Fees are stored as positive values, their impact is negative in net_profit
                    currency,
                });
            }
        }
    }

    calculate(method: 'FIFO' | 'AVG' = 'FIFO'): CalculationResult {
        const closedTrades: ClosedTrade[] = [];
        const openPositions: Record<string, Lot[]> = {};
        const totalsByCurrency: Record<string, { realized_profit: number, fees_paid: number, dividends: number, net_profit: number }> = {};

        const initCurrency = (ccy: string) => {
            if (!totalsByCurrency[ccy]) {
                totalsByCurrency[ccy] = { realized_profit: 0, fees_paid: 0, dividends: 0, net_profit: 0 };
            }
        };

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
                initCurrency(trade.currency);

                if (trade.direction === TradeDirection.BUY) {
                    // Avg cost per share for this lot
                    const unitCost = (trade.price * trade.quantity + trade.fee) / trade.quantity;
                    ledger.push({
                        date: trade.date,
                        quantity: trade.quantity,
                        unit_cost: unitCost,
                        price_paid: trade.price * trade.quantity,
                        fees_paid: trade.fee,
                        currency: trade.currency
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
                        currency: trade.currency,
                        method
                    });

                    totalsByCurrency[trade.currency].realized_profit += realizedProfit;
                }
            }
            if (ledger.length > 0) {
                openPositions[ticker] = ledger;
            }
        }

        const totalRealized = closedTrades.reduce((sum, t) => sum + t.realized_profit, 0);
        const standaloneFees = this.fees.reduce((sum, f) => sum + Math.abs(f.amount), 0);
        const totalDividends = this.dividends.reduce((sum, d) => sum + d.amount, 0);

        // Aggregate fees and dividends by currency
        for (const fee of this.fees) {
            initCurrency(fee.currency);
            totalsByCurrency[fee.currency].fees_paid += Math.abs(fee.amount);
        }

        for (const div of this.dividends) {
            initCurrency(div.currency);
            totalsByCurrency[div.currency].dividends += div.amount;
        }

        // Calculate net profit per currency
        for (const ccy in totalsByCurrency) {
            const t = totalsByCurrency[ccy];
            t.net_profit = t.realized_profit - t.fees_paid + t.dividends;
        }

        return {
            closed_trades: closedTrades,
            open_positions: openPositions,
            total_realized_profit: totalRealized,
            total_fees_paid: standaloneFees,
            total_dividends: totalDividends,
            net_profit: totalRealized - standaloneFees + totalDividends,
            dividends: this.dividends,
            fees: this.fees,
            totals_by_currency: totalsByCurrency
        };
    }
}
