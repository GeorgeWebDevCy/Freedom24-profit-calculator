
export enum TradeDirection {
    BUY = "Buy",
    SELL = "Sell",
    DEPOSIT = "Deposit",
    WITHDRAWAL = "Withdrawal",
    FEE = "Fee"
}

export interface Trade {
    id?: string;
    date: Date;
    ticker: string;
    direction: TradeDirection;
    quantity: number;
    price: number;
    fee: number;
    amount: number;
    currency: string;
    datetime_str?: string;
}

export interface Lot {
    date: Date;
    quantity: number;
    unit_cost: number;
    price_paid: number;
    fees_paid: number;
    currency: string;
    market_price?: number;
}

export interface ClosedTrade {
    ticker: string;
    date: Date;
    quantity: number;
    sell_price: number;
    sell_fees: number;
    cost_basis: number;
    realized_profit: number;
    sale_proceeds: number;
    currency: string;
    method: 'FIFO' | 'AVG';
}

export interface FeeRecord {
    date: Date;
    description: string;
    amount: number; // Negative for cost
    currency: string;
}

export interface Dividend {
    date: Date;
    description: string;
    amount: number; // Positive for income
    currency: string;
}

export interface CurrencyTotals {
    realized_profit: number;
    fees_paid: number;
    dividends: number;
    net_profit: number;
}

export interface CashTransaction {
    date: Date;
    type: 'DEPOSIT' | 'WITHDRAWAL';
    amount: number;
    currency: string;
    description: string;
}

export interface PerformanceMetrics {
    roi: number;
    annualizedReturn: number;
    winLossRatio: {
        wins: number;
        losses: number;
        ratio: number;
        winRate: number;
    };
    averageHoldingPeriod: number;
    bestTrades: ClosedTrade[];
    worstTrades: number;
    totalInvested: number;
    currentValue: number;
}

export interface CalculationResult {
    closed_trades: ClosedTrade[];
    open_positions: Record<string, Lot[]>;
    total_realized_profit: number;
    total_fees_paid: number; // Aggregated standalone fees (positive)
    total_dividends: number; // Aggregated dividends (positive)
    net_profit: number; // Realized - Fees + Dividends
    dividends: Dividend[];
    fees: FeeRecord[]; // Array to hold fee records for filtering
    cash_transactions: CashTransaction[];
    calculated_cash_balances: Record<string, number>;
    totals_by_currency: Record<string, CurrencyTotals>;
    openPositionsSource: 'IMPORTED' | 'CALCULATED';
    performance_metrics?: PerformanceMetrics;
}
