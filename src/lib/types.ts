
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
    datetime_str?: string;
}

export interface Lot {
    date: Date;
    quantity: number;
    unit_cost: number;
    price_paid: number;
    fees_paid: number;
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
    method: 'FIFO' | 'AVG';
}

export interface FeeRecord {
    date: Date;
    description: string;
    amount: number; // Negative for cost
    currency: string;
}

export interface CalculationResult {
    closed_trades: ClosedTrade[];
    open_positions: Record<string, Lot[]>;
    total_realized_profit: number;
    total_fees_paid: number; // Aggregated standalone fees
    net_profit: number; // Realized - Fees
}
