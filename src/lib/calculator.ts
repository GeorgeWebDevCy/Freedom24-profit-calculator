
import { read, utils } from 'xlsx';
import { CalculationResult, ClosedTrade, Dividend, FeeRecord, Trade, Lot, CashTransaction, TradeDirection, TaxCalculation, TaxSettings } from './types';
import { calculatePerformanceMetrics } from './performance-calculator';
import { TaxCalculatorService } from './services/tax-calculator.service';

export class ProfitCalculator {
    trades: Trade[] = [];
    cashTransactions: CashTransaction[] = [];
    fees: FeeRecord[] = [];
    dividends: Dividend[] = [];
    importedPositions: Record<string, Lot[]> = {};

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
        this.cashTransactions = [];

        for (const row of data) {
            const amountRaw = this.parseNumber(this.getValue(row, ['Amount', 'Value', 'Total', 'Sum']));
            const direction = String(this.getValue(row, ['Direction', 'Type', 'Operation', 'Action']) ?? '').toLowerCase();
            const comment = String(this.getValue(row, ['Comment', 'Description', 'Details']) ?? '');
            const currency = String(this.getValue(row, ['Currency']) ?? 'USD');
            const date = this.parseDate(this.getValue(row, ['Date']));

            // Check for Dividend
            const isDividend = (direction.includes('dividend')
                || comment.toLowerCase().includes('dividend')
                || direction.includes('div')
                || comment.toLowerCase().includes('div payment'));

            if (isDividend) {
                const amount = Math.abs(amountRaw);
                if (!amount) continue;
                this.dividends.push({ date, description: comment || direction, amount, currency });
                continue;
            }

            // Check for Cash Transfer (Deposit/Withdrawal)
            const isDeposit = direction.includes('deposit') || direction.includes('top up') || direction.includes('incoming') || comment.toLowerCase().includes('deposit');
            const isWithdrawal = direction.includes('withdrawal') || direction.includes('outgoing') || comment.toLowerCase().includes('withdrawal');

            if (isDeposit || isWithdrawal) {
                const amount = Math.abs(amountRaw);
                if (!amount) continue;
                this.cashTransactions.push({
                    date,
                    type: isDeposit ? 'DEPOSIT' : 'WITHDRAWAL',
                    amount,
                    currency,
                    description: comment || direction
                });
                continue;
            }

            // Check for Tax/Fee (everything else that is negative)
            // If it's not a dividend and not a transfer, assume it's a fee if explicitly marked or just negative flow
            const isTax = direction.includes('tax') || direction.includes('fee') || direction.includes('commission')
                || comment.toLowerCase().includes('tax') || comment.toLowerCase().includes('fee')
                || comment.toLowerCase().includes('commission');

            if (isTax || amountRaw < 0) {
                const amount = Math.abs(amountRaw);
                if (!amount) continue;
                this.fees.push({ date, description: comment || direction, amount, currency });
            }
        }
    }

    async loadOpenPositions(fileBuffer: ArrayBuffer) {
        const wb = read(fileBuffer, { type: 'array', cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data: any[] = utils.sheet_to_json(ws, { defval: null });

        this.importedPositions = {};

        for (const row of data) {
            const ticker = String(this.getValue(row, ['Ticker', 'Symbol', 'Instrument', 'ISIN']) ?? '').trim();
            if (!ticker) continue;

            const quantity = Math.abs(this.parseNumber(this.getValue(row, ['Quantity', 'Qty', 'Volume', 'Amount'])));
            const avgPrice = this.parseNumber(this.getValue(row, ['Average Price', 'Entry Price', 'Avg Price', 'Open Price']));
            const marketPrice = this.parseNumber(this.getValue(row, ['Current Price', 'Market Price', 'Last Price', 'Price']));
            const currency = String(this.getValue(row, ['Currency', 'Curr']) ?? 'USD');

            if (!quantity) continue;

            if (!this.importedPositions[ticker]) {
                this.importedPositions[ticker] = [];
            }

            this.importedPositions[ticker].push({
                date: new Date(), // Default to now
                quantity,
                unit_cost: avgPrice,
                price_paid: quantity * avgPrice,
                fees_paid: 0,
                currency,
                market_price: marketPrice || avgPrice, // Default to avgPrice if no market price found
            });
        }
    }

    calculate(method: 'FIFO' | 'AVG' = 'FIFO', taxSettings?: TaxSettings): CalculationResult {
        const closedTrades: ClosedTrade[] = [];
        let openPositions: Record<string, Lot[]> = {};
        const totalsByCurrency: Record<string, { realized_profit: number, fees_paid: number, dividends: number, net_profit: number }> = {};
        const cashBalances: Record<string, number> = {};

        const initCurrency = (ccy: string) => {
            if (!totalsByCurrency[ccy]) {
                totalsByCurrency[ccy] = { realized_profit: 0, fees_paid: 0, dividends: 0, net_profit: 0 };
            }
            if (!cashBalances[ccy]) cashBalances[ccy] = 0;
        };

        // 1. Process Cash Transactions
        for (const trans of this.cashTransactions) {
            initCurrency(trans.currency);
            if (trans.type === 'DEPOSIT') {
                cashBalances[trans.currency] += trans.amount;
            } else {
                cashBalances[trans.currency] -= trans.amount;
            }
        }

        // 2. Process Trades (Cash flow impact)
        // Note: We need to iterate ALL trades to get cash flow, not just closed ones.
        // But the parse logic separates buys/sells.
        // BUY: Cash - (Price * Qty + Fee)
        // SELL: Cash + (Price * Qty - Fee)
        // However, the `Trade` object has `amount` which is (Price*Qty). Fee is separate.
        // Let's rely on the raw values.

        for (const trade of this.trades) {
            initCurrency(trade.currency);
            // 'amount' in Trade is usually Price * Qty (positive).
            // But verify if the file provided negative for Sells or we normalized it.
            // normalize: amount = abs(rawAmount).

            // Fee is always parsed as positive expense.

            if (trade.direction === TradeDirection.BUY) {
                // Cash OUT: Cost of shares + Fee
                // If the CSV 'Amount' included fee, we might double count if we add fee again.
                // Standard Freedom24 CSV: Amount = Price * Qty. Fee is separate column.
                cashBalances[trade.currency] -= (trade.amount + trade.fee);
            } else if (trade.direction === TradeDirection.SELL) {
                // Cash IN: Proceeds from sale - Fee
                cashBalances[trade.currency] += (trade.amount - trade.fee);
            }
        }

        // 3. Process Dividends
        for (const div of this.dividends) {
            initCurrency(div.currency);
            cashBalances[div.currency] += div.amount;
            totalsByCurrency[div.currency].dividends += div.amount;
        }

        // 4. Process Standalone Fees (from Fees file)
        for (const fee of this.fees) {
            initCurrency(fee.currency);
            cashBalances[fee.currency] -= fee.amount;
            totalsByCurrency[fee.currency].fees_paid += fee.amount;
        }

        // ... (existing FIFO/AVG logic for realized profit - Does not affect cash balance directly, only P/L stats)
        // Group by ticker
        const tradesByTicker: Record<string, Trade[]> = {};
        for (const t of this.trades) {
            if (!tradesByTicker[t.ticker]) tradesByTicker[t.ticker] = [];
            tradesByTicker[t.ticker].push(t);
        }

        for (const ticker in tradesByTicker) {
            // ... (existing logic)
            const tickerTrades = tradesByTicker[ticker];
            const ledger: Lot[] = [];

            for (const trade of tickerTrades) {
                initCurrency(trade.currency);

                if (trade.direction === TradeDirection.BUY) {
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
                        while (qtyToSell > 0 && ledger.length > 0) {
                            const head = ledger[0];
                            if (head.quantity <= qtyToSell) {
                                costBasis += head.quantity * head.unit_cost;
                                qtyToSell -= head.quantity;
                                ledger.shift();
                            } else {
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
                            const ratio = (totalQty - qtyToSell) / totalQty;
                            const newLedger: Lot[] = [];
                            for (const lot of ledger) {
                                lot.quantity *= ratio;
                                if (lot.quantity > 1e-9) newLedger.push(lot);
                            }
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

        // Override open positions if imported
        if (Object.keys(this.importedPositions).length > 0) {
            openPositions = { ...this.importedPositions };
        }

        const totalRealized = closedTrades.reduce((sum, t) => sum + t.realized_profit, 0);
        const standaloneFees = this.fees.reduce((sum, f) => sum + Math.abs(f.amount), 0);
        const totalDividends = this.dividends.reduce((sum, d) => sum + d.amount, 0);

        // Calculate net profit per currency
        for (const ccy in totalsByCurrency) {
            const t = totalsByCurrency[ccy];
            t.net_profit = t.realized_profit - t.fees_paid + t.dividends;
        }

        // Calculate total market value of open positions
        const openPositionsMarketValue = Object.values(openPositions)
            .flat()
            .reduce((sum, lot) => sum + (lot.quantity * (lot.market_price ?? lot.unit_cost)), 0);

        // Calculate total cash balance
        const totalCashBalance = Object.values(cashBalances).reduce((sum, bal) => sum + bal, 0);

        // Calculate performance metrics
        const allTradesForHolding = this.trades.map(t => ({
            date: t.date,
            ticker: t.ticker,
            direction: t.direction === TradeDirection.BUY ? 'Buy' : 'Sell'
        }));

        const performanceMetrics = calculatePerformanceMetrics(
            closedTrades,
            allTradesForHolding,
            this.cashTransactions,
            totalRealized,
            totalDividends,
            standaloneFees,
            openPositionsMarketValue,
            totalCashBalance
        );

        // Calculate tax data if settings provided
        let taxCalculations: Record<number, TaxCalculation> = {};
        let taxLots: Record<string, any[]> = {};
        let taxOptimizations: any[] = [];
        let washSaleWarnings: any[] = [];
        let harvestingOpportunities: any[] = [];

        if (taxSettings && taxSettings.optimizationEnabled) {
            const taxCalculator = new TaxCalculatorService();
            
            // Generate tax lots
            taxLots = taxCalculator.generateTaxLots(this.trades);
            
            // Calculate tax for current year
            const currentYear = new Date().getFullYear();
            const residency = taxSettings.residencies.find(r => r.country === 'United States') || taxSettings.residencies[0];
            
            const taxCalc = taxCalculator.calculateTaxLiability(
                currentYear,
                residency,
                taxLots,
                this.dividends
            );

            taxCalculations[currentYear] = taxCalc;

            // Detect wash sales if enabled
            if (taxSettings.washSaleEnabled) {
                washSaleWarnings = taxCalculator.detectWashSales(this.trades, taxLots);
            }

            // Identify harvesting opportunities
            harvestingOpportunities = taxCalculator.identifyHarvestingOpportunities(
                openPositions,
                new Map(), // Would be populated with current prices
                taxSettings.harvestThreshold
            );
        }

        return {
            closed_trades: closedTrades,
            open_positions: openPositions,
            total_realized_profit: totalRealized,
            total_fees_paid: standaloneFees,
            total_dividends: totalDividends,
            net_profit: totalRealized - standaloneFees + totalDividends, // Overall net profit
            dividends: this.dividends,
            fees: this.fees,
            cash_transactions: this.cashTransactions,
            calculated_cash_balances: cashBalances,
            totals_by_currency: totalsByCurrency,
            openPositionsSource: Object.keys(this.importedPositions).length > 0 ? 'IMPORTED' : 'CALCULATED',
            performance_metrics: performanceMetrics,
            taxCalculations,
            taxLots,
            taxOptimizations,
            washSaleWarnings,
            harvestingOpportunities
        };
    }
}
