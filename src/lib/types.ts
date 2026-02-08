
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

// Tax-related interfaces
export interface TaxResidency {
    country: string;
    taxYear: number;
    taxRate: {
        shortTerm: number;    // < 1 year
        longTerm: number;     // >= 1 year
        dividend: number;
        // Country-specific rates
        marginal?: number;
        capitalGains?: number;
    };
}

export interface TaxLot {
    id: string;
    ticker: string;
    quantity: number;
    acquisitionDate: Date;
    acquisitionPrice: number;
    acquisitionCost: number;
    dispositionDate?: Date;
    dispositionPrice?: number;
    holdingPeriodDays: number;
    taxTreatment: 'short_term' | 'long_term';
    washSale?: boolean;
    currency: string;
}

export interface TaxCalculation {
    year: number;
    residency: TaxResidency;
    shortTermGains: number;
    longTermGains: number;
    dividendIncome: number;
    taxDeductibleExpenses: number;
    estimatedTax: number;
    effectiveRate: number;
    taxLossCarryforward: number;
    harvestedLosses: number;
    netTaxableGain: number;
}

export interface TaxOptimization {
    id: string;
    type: 'harvesting' | 'deferral' | 'location' | 'timing';
    description: string;
    potentialSavings: number;
    implementation: {
        action: string;
        targetSecurity: string;
        timeline: string;
        risk: 'low' | 'medium' | 'high';
    };
}

export interface TaxSettings {
    residencies: TaxResidency[];
    defaultCurrency: string;
    optimizationEnabled: boolean;
    harvestThreshold: number;
    washSaleEnabled: boolean;
    taxLossCarryforwardEnabled: boolean;
}

export interface TaxReport {
    id: string;
    year: number;
    format: 'pdf' | 'excel' | 'csv';
    generatedAt: Date;
    data: TaxCalculation;
}

export interface WashSaleWarning {
    id: string;
    ticker: string;
    lossDate: Date;
    repurchaseDate: Date;
    potentialLoss: number;
    affectedLots: string[];
}

export interface HarvestingOpportunity {
    id: string;
    ticker: string;
    quantity: number;
    unrealizedLoss: number;
    potentialTaxSavings: number;
    confidence: number;
    riskLevel: 'low' | 'medium' | 'high';
}

// Alert-related interfaces
export interface PriceAlert {
    id: string;
    symbol: string;
    type: 'price_above' | 'price_below' | 'percentage_change' | 'volume_spike' | 'portfolio_value';
    isActive: boolean;
    threshold: number;
    currentValue?: number;
    createdAt: Date;
    triggeredAt?: Date;
    notificationSent: boolean;
    currency: string;
    condition: {
        operator: '>' | '<' | '>=' | '<=' | 'percentage' | 'dollar_change';
        value: number;
        timeframe?: number; // in hours/days
    };
    repeatSettings?: {
        enabled: boolean;
        frequency: 'once' | 'daily' | 'weekly' | 'until_canceled';
        maxTriggers?: number;
    };
}

export interface AlertNotification {
    id: string;
    alertId: string;
    type: 'info' | 'success' | 'warning' | 'error';
    title: string;
    message: string;
    timestamp: Date;
    read: boolean;
    data: {
        symbol: string;
        currentValue: number;
        threshold: number;
        change: number;
        percentageChange?: number;
    };
    channels: ('in_app' | 'email' | 'push' | 'webhook')[];
}

export interface AlertSettings {
    enabled: boolean;
    defaultCurrency: string;
    notificationChannels: {
        in_app: boolean;
        email: boolean;
        push: boolean;
        webhook?: {
            url: string;
            enabled: boolean;
        };
    };
    quietHours: {
        enabled: boolean;
        start: string; // HH:MM format
        end: string;   // HH:MM format
    };
    cooldownPeriod: number; // minutes between similar alerts
    maxAlertsPerDay: number;
    soundEnabled: boolean;
    desktopNotifications: boolean;
}

// Search-related interfaces
export interface SearchQuery {
    id: string;
    query: string;
    type: 'text' | 'ticker' | 'advanced';
    filters: SearchFilters;
    timestamp: Date;
    results?: SearchResult[];
    saved: boolean;
}

export interface SearchFilters {
    dateRange?: {
        start: Date;
        end: Date;
    };
    assetTypes?: string[]; // ['stocks', 'bonds', 'etfs', etc.]
    sectors?: string[]; // ['technology', 'healthcare', 'finance', etc.]
    marketCap?: string[]; // ['large', 'mid', 'small', 'micro']
    countries?: string[]; // ['US', 'UK', 'DE', etc.]
    priceRange?: {
        min: number;
        max: number;
    };
    performance?: {
        minReturn: number;
        maxReturn: number;
        minVolatility: number;
        maxVolatility: number;
    };
    customFilters?: {
        [key: string]: any;
    };
}

export interface SearchResult {
    id: string;
    type: 'trade' | 'position' | 'dividend' | 'fee' | 'alert';
    title: string;
    description: string;
    data: any;
    timestamp: Date;
    relevanceScore: number;
}

export interface SavedSearch {
    id: string;
    name: string;
    query: SearchQuery;
    timestamp: Date;
    lastUsed?: Date;
    useCount: number;
    pinned: boolean;
}

export interface AdvancedSearchOperators {
    boolean: {
        and: boolean;
        or: boolean;
        not: boolean;
    };
    comparison: {
        contains: string;
        startsWith: string;
        endsWith: string;
        equals: string;
        greaterThan: number;
        lessThan: number;
        between: { min: number; max: number };
    };
    date: {
        before: Date;
        after: Date;
        on: Date;
        within: number; // days
        between: { start: Date; end: Date };
    };
}

export interface SearchAnalytics {
    totalSearches: number;
    popularQueries: { query: string; count: number }[];
    searchTrends: { term: string; frequency: number }[];
    averageResultCount: number;
    searchSuccessRate: number;
}

export interface AlertHistory {
    id: string;
    alertId: string;
    timestamp: Date;
    type: string;
    symbol: string;
    currentValue: number;
    threshold: number;
    change: number;
    triggered: boolean;
    acknowledged: boolean;
}

export interface MarketCondition {
    type: 'volatility_spike' | 'unusual_volume' | 'gap_up' | 'gap_down' | 'resistance_break' | 'support_break';
    symbol: string;
    severity: 'low' | 'medium' | 'high';
    timestamp: Date;
    details: {
        currentPrice: number;
        previousPrice: number;
        volume: number;
        averageVolume: number;
        volatility: number;
        description: string;
    };
}

export interface AlertTemplate {
    id: string;
    name: string;
    description: string;
    template: PriceAlert;
    category: 'price' | 'volume' | 'portfolio' | 'technical';
    popular: boolean;
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
    taxCalculations?: Record<number, TaxCalculation>;
    taxOptimizations?: TaxOptimization[];
    taxLots?: Record<string, TaxLot[]>;
    washSaleWarnings?: WashSaleWarning[];
    harvestingOpportunities?: HarvestingOpportunity[];
    priceAlerts?: PriceAlert[];
    alertHistory?: AlertHistory[];
    marketConditions?: MarketCondition[];
}
