import React, { useState, useEffect } from 'react';
import { CalculationResult, ClosedTrade, Dividend, FeeRecord, Lot, TaxSettings } from '../lib/types';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { ArrowDownRight, DollarSign, PieChart, Activity, FileText, Table as TableIcon, Settings, Save, X, AlertTriangle, TrendingUp, Target, Award, Clock, RefreshCw, Calculator } from 'lucide-react';
import { exportToPDF, exportToExcel } from '../lib/export';
import { getExchangeRates, getCachedRates } from '../lib/exchange-rate-service';
import { fetchStockPrices, type StockPrice } from '../lib/price-service';
import { TaxDashboard } from './tax-optimization/TaxDashboard';
import { TaxSettingsComponent } from './tax-optimization/TaxSettings';
import { TaxCalculatorService } from '../lib/services/tax-calculator.service';
import { AlertManager } from './alerts/AlertManager';
import { AlertsService } from '../lib/services/alerts.service';
import { SearchPanel } from './search/SearchPanel';
import { SearchService } from '../lib/services/search.service';

interface DashboardProps {
    data: CalculationResult;
    onReset: () => void;
}

type Tab = 'trades' | 'positions' | 'dividends' | 'fees' | 'performance' | 'tax' | 'alerts' | 'search';

export const Dashboard: React.FC<DashboardProps> = ({ data, onReset }) => {
    const [selectedYear, setSelectedYear] = useState<string>('All');
    const [activeTab, setActiveTab] = useState<Tab>('trades');
    const [showSettings, setShowSettings] = useState(false);
    const [showTaxSettings, setShowTaxSettings] = useState(false);
    const [taxSettings, setTaxSettings] = useState<TaxSettings>(() => ({
        residencies: TaxCalculatorService.getDefaultTaxResidencies(),
        defaultCurrency: 'USD',
        optimizationEnabled: true,
        harvestThreshold: 1000,
        washSaleEnabled: true,
        taxLossCarryforwardEnabled: true
    }));
    const [alertService, setAlertService] = useState<AlertsService | null>(null);
    const [searchService, setSearchService] = useState<SearchService | null>(null);

    const [exchangeRates, setExchangeRates] = useState<Record<string, number>>(() => {
        const saved = typeof window !== 'undefined' ? localStorage.getItem('f24_exchange_rates') : null;
        return saved ? JSON.parse(saved) : {
            'USD': 1,
            'EUR': 0.92, // Default to approx current rate
            'GBP': 0.81,
            'PLN': 4.10,
        };
    });

    const [ratesLastUpdated, setRatesLastUpdated] = useState<Date | null>(() => {
        const cached = getCachedRates();
        return cached ? cached.lastUpdated : null;
    });

    const [fetchingRates, setFetchingRates] = useState(false);

    const [stockPrices, setStockPrices] = useState<Map<string, StockPrice>>(new Map());
    const [fetchingPrices, setFetchingPrices] = useState(false);
    const [pricesLastUpdated, setPricesLastUpdated] = useState<Date | null>(null);

    // Persist rates
    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('f24_exchange_rates', JSON.stringify(exchangeRates));
        }
    }, [exchangeRates]);

    const [cashBalances, setCashBalances] = useState<Record<string, number>>({});

    // Ensure all currencies in data have a rate
    useEffect(() => {
        const uniqueCurrencies = new Set<string>();
        const traverse = (items: { currency: string }[]) => items.forEach(i => uniqueCurrencies.add(i.currency));
        traverse(data.closed_trades);
        traverse(data.dividends);
        traverse(data.fees);
        Object.values(data.open_positions).flat().forEach(p => uniqueCurrencies.add(p.currency));
        if (data.cash_transactions) data.cash_transactions.forEach(t => uniqueCurrencies.add(t.currency));

        setExchangeRates(prev => {
            // ... (existing exchange rate logic)
            const next = { ...prev };
            let changed = false;
            uniqueCurrencies.forEach(c => {
                if (!next[c]) {
                    next[c] = 1;
                    changed = true;
                }
            });
            return changed ? next : prev;
        });

        // Initialize cash balances from calculated values if available, respecting manual edits if we had a persistent store (which we don't yet)
        // For now, simple override: if calculated > 0 or explicit, use it.
        // But we want to preserve user edits if they change tabs? 
        // Actually, on "data" change (file import), we should reset to calculated.

        if (data.calculated_cash_balances) {
            setCashBalances(prev => {
                // Merge calculated with existing? Or just set to calculated?
                // If data changed, likely a new file load -> set to calculated.
                return { ...data.calculated_cash_balances };
            });
        }
    }, [data]);

    // Auto-fetch exchange rates on mount if cache is stale
    useEffect(() => {
        const initRates = async () => {
            try {
                const result = await getExchangeRates('USD', false);
                if (!result.fromCache) {
                    setExchangeRates(result.rates);
                    setRatesLastUpdated(result.lastUpdated);
                }
            } catch (error) {
                console.error('Failed to auto-fetch exchange rates:', error);
            }
        };
        initRates();
    }, []);

    // Handler to manually fetch latest rates
    const handleFetchRates = async () => {
        setFetchingRates(true);
        try {
            const result = await getExchangeRates('USD', true);
            setExchangeRates(result.rates);
            setRatesLastUpdated(result.lastUpdated);
        } catch (error) {
            console.error('Failed to fetch exchange rates:', error);
            alert('Failed to fetch exchange rates. Please check your internet connection.');
        } finally {
            setFetchingRates(false);
        }
    };

    // Initialize alerts service
    useEffect(() => {
        const settings = AlertsService.getDefaultSettings();
        const service = new AlertsService(settings);
        setAlertService(service);

        // Get symbols from data for monitoring
        const symbols = new Set<string>();
        data.closed_trades.forEach(trade => symbols.add(trade.ticker));
        Object.keys(data.open_positions).forEach(ticker => symbols.add(ticker));

        if (symbols.size > 0) {
            service.startMonitoring(Array.from(symbols));
        }

        return () => {
            service.stopMonitoring();
        };
    }, [data]);

    // Initialize services
useEffect(() => {
        // Initialize alerts service
        if (!alertService) {
            const alertSettings = AlertsService.getDefaultSettings();
            const service = new AlertsService(alertSettings);
            setAlertService(service);

            // Get symbols from data for monitoring
            const symbols = new Set<string>();
            data.closed_trades.forEach(trade => symbols.add(trade.ticker));
            Object.keys(data.open_positions).forEach(ticker => symbols.add(ticker));

            if (symbols.size > 0) {
                service.startMonitoring(Array.from(symbols));
            }
        }

        // Initialize search service
        if (!searchService) {
            const service = new SearchService();
            setSearchService(service);
        }

        // Build search index if not exists
        if (data.closed_trades.length > 0 || Object.keys(data.open_positions).length > 0) {
            service.buildSearchIndex(data);
        }

        return () => {
            searchService?.stopMonitoring?.();
            alertService?.stopMonitoring?.();
        };
    }, [data]);

    // Extract unique currencies for selection
    const currencies = React.useMemo(() => {
        // Combine currencies from exchange rates and cash balances
        const allCurrencies = new Set([...Object.keys(exchangeRates), ...Object.keys(cashBalances)]);
        return Array.from(allCurrencies).sort();
    }, [exchangeRates, cashBalances]);

    const [selectedCurrency, setSelectedCurrency] = useState<string>('EUR');

    // Extract unique years
    const years = React.useMemo(() => {
        const years = new Set<string>();
        data.closed_trades.forEach(t => years.add(t.date.getFullYear().toString()));
        data.dividends.forEach(d => years.add(d.date.getFullYear().toString()));
        data.fees.forEach(f => years.add(f.date.getFullYear().toString()));
        return Array.from(years).sort().reverse();
    }, [data]);

    // Conversion helper
    const convert = (amount: number, from: string, to: string) => {
        if (from === to) return amount;
        const rateFrom = exchangeRates[from] || 1;
        const rateTo = exchangeRates[to] || 1;
        // Convert to USD (base 1), then to target
        // amount / rateFrom = amountInUSD
        // amountInUSD * rateTo = amountInTarget
        return (amount / rateFrom) * rateTo;
    };

    // Filter AND Convert data based on selected year AND currency
    const processedData = React.useMemo(() => {
        const year = selectedYear === 'All' ? null : parseInt(selectedYear);

        const convertTrade = (t: ClosedTrade): ClosedTrade => ({
            ...t,
            // Convert monetary values
            sell_price: convert(t.sell_price, t.currency, selectedCurrency),
            sell_fees: convert(t.sell_fees, t.currency, selectedCurrency),
            cost_basis: convert(t.cost_basis, t.currency, selectedCurrency),
            realized_profit: convert(t.realized_profit, t.currency, selectedCurrency),
            sale_proceeds: convert(t.sale_proceeds, t.currency, selectedCurrency),
            currency: selectedCurrency // It's now in the target currency
        });

        const convertDiv = (d: Dividend): Dividend => ({
            ...d,
            amount: convert(d.amount, d.currency, selectedCurrency),
            currency: selectedCurrency
        });

        const convertFee = (f: FeeRecord): FeeRecord => ({
            ...f,
            amount: convert(f.amount, f.currency, selectedCurrency),
            currency: selectedCurrency
        });

        // 1. Filter by Year
        // 2. Map to convert currency
        const closed_trades = data.closed_trades
            .filter(t => year === null || t.date.getFullYear() === year)
            .map(convertTrade);

        const dividends = data.dividends
            .filter(d => year === null || d.date.getFullYear() === year)
            .map(convertDiv);

        const fees = data.fees
            .filter(f => year === null || f.date.getFullYear() === year)
            .map(convertFee);

        // Filter open positions? Usually we want to see all current assets
        // But maybe we want to see them converted.
        const open_positions: Record<string, Lot[]> = {};
        for (const [ticker, lots] of Object.entries(data.open_positions)) {
            open_positions[ticker] = lots.map(l => ({
                ...l,
                unit_cost: convert(l.unit_cost, l.currency, selectedCurrency),
                market_price: l.market_price ? convert(l.market_price, l.currency, selectedCurrency) : undefined,
                price_paid: convert(l.price_paid, l.currency, selectedCurrency),
                fees_paid: convert(l.fees_paid, l.currency, selectedCurrency),
                currency: selectedCurrency
            }));
        }

        const total_realized_profit = closed_trades.reduce((sum, t) => sum + t.realized_profit, 0);
        const total_dividends = dividends.reduce((sum, d) => sum + d.amount, 0);
        const total_fees_paid = fees.reduce((sum, f) => sum + f.amount, 0);

        return {
            closed_trades,
            dividends,
            fees,
            open_positions,
            total_realized_profit,
            total_dividends,
            total_fees_paid,
            net_profit: total_realized_profit - total_fees_paid + total_dividends
        };
    }, [data, selectedYear, selectedCurrency, exchangeRates]);

    // Sort closed trades by date
    const sortedTrades = [...processedData.closed_trades].sort((a, b) => b.date.getTime() - a.date.getTime()); // Newer first

    let cumulative = 0;
    // For chart we need chronological order
    const chartData = [...processedData.closed_trades].sort((a, b) => a.date.getTime() - b.date.getTime()).map(t => {
        cumulative += t.realized_profit;
        return {
            date: t.date.toLocaleDateString(),
            profit: t.realized_profit,
            cumulative: cumulative
        };
    });

    const profitByTicker = new Map<string, number>();
    for (const trade of processedData.closed_trades) {
        profitByTicker.set(trade.ticker, (profitByTicker.get(trade.ticker) || 0) + trade.realized_profit);
    }
    const tickerData = [...profitByTicker.entries()]
        .map(([ticker, profit]) => ({ ticker, profit }))
        .sort((a, b) => b.profit - a.profit)
        .slice(0, 20); // Top 20

    // Flatten open positions for table
    const flatOpenPositions = Object.values(processedData.open_positions).flat();
    // Group by ticker for display (since we already flattened logic per lot in calculator, but UI wants summary per ticker)
    const openPositionsSummary = Object.entries(processedData.open_positions)
        .map(([ticker, lots]) => {
            const totalQty = lots.reduce((sum, lot) => sum + lot.quantity, 0);
            const totalCost = lots.reduce((sum, lot) => sum + lot.price_paid, 0); // price_paid is already quantity * unit_cost

            // Use fetched price if available, otherwise fall back to lot's market_price or unit_cost
            const fetchedPrice = stockPrices.get(ticker);
            let currentPrice: number;

            if (fetchedPrice) {
                // Convert fetched price to selected currency
                currentPrice = convert(fetchedPrice.price, fetchedPrice.currency, selectedCurrency);
            } else {
                // Fall back to existing market price or unit cost
                const avgMarketPrice = lots.reduce((sum, lot) => sum + (lot.market_price ?? lot.unit_cost), 0) / lots.length;
                currentPrice = avgMarketPrice;
            }

            // Market value is qty * market_price (or unit_cost if missing)
            const totalMarketValue = totalQty * currentPrice;
            const avgCost = totalQty > 0 ? totalCost / totalQty : 0;
            return {
                ticker,
                quantity: totalQty,
                avg_cost: avgCost,
                total_cost: totalCost,
                market_value: totalMarketValue,
                unrealized_profit: totalMarketValue - totalCost,
                current_price: currentPrice,
                has_live_price: !!fetchedPrice
            };
        }).sort((a, b) => a.ticker.localeCompare(b.ticker));


    const formatCurrency = (val: number | undefined) => {
        if (val === undefined || val === null) return '';
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: selectedCurrency, maximumFractionDigits: 2 }).format(val);
    };

    const handleRateChange = (currency: string, newRate: string) => {
        const rate = parseFloat(newRate);
        if (!isNaN(rate)) {
            setExchangeRates(prev => ({ ...prev, [currency]: rate }));
        }
    };

    const handleCashChange = (currency: string, newValue: string) => {
        const val = parseFloat(newValue);
        if (!isNaN(val)) {
            setCashBalances(prev => ({ ...prev, [currency]: val }));
        }
    };

    // Calculate total net assets
    const totalMarketValue = openPositionsSummary.reduce((sum, p) => sum + p.market_value, 0);
    const totalCashValue = Object.entries(cashBalances).reduce((sum, [curr, amount]) => {
        return sum + convert(amount, curr, selectedCurrency);
    }, 0);
    const netAssets = totalMarketValue + totalCashValue;

    return (
        <div className="h-screen flex flex-col bg-[#121212] text-white overflow-hidden relative">
            {/* Settings Modal */}
            {showSettings && (
                <div className="absolute inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
                    <div className="bg-[#1a1a1a] border border-gray-700 rounded-lg p-6 max-w-md w-full shadow-2xl flex flex-col max-h-[90vh]">
                        <div className="flex justify-between items-center mb-4 flex-none">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <Settings className="text-blue-400" /> Settings
                            </h2>
                            <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-white">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-auto space-y-6">
                            {/* Exchange Rates Section */}
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <h3 className="text-sm font-semibold text-gray-300 border-b border-gray-700 pb-1 flex-1">Exchange Rates (Base USD)</h3>
                                    <button
                                        onClick={handleFetchRates}
                                        disabled={fetchingRates}
                                        className="px-3 py-1 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded text-xs font-medium flex items-center gap-1.5 transition-colors"
                                        title="Fetch latest exchange rates"
                                    >
                                        <RefreshCw size={14} className={fetchingRates ? 'animate-spin' : ''} />
                                        {fetchingRates ? 'Fetching...' : 'Update Rates'}
                                    </button>
                                </div>
                                {ratesLastUpdated && (
                                    <p className="text-xs text-gray-500 mb-2">
                                        Last updated: {ratesLastUpdated.toLocaleString()}
                                    </p>
                                )}
                                <p className="text-xs text-gray-400 mb-2">Example: 1 USD = 0.95 EUR</p>
                                <div className="space-y-2">
                                    {Object.entries(exchangeRates).map(([curr, rate]) => (
                                        <div key={curr} className="flex items-center justify-between bg-gray-800 p-2 rounded">
                                            <span className="font-bold text-blue-400 w-12">{curr}</span>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="number"
                                                    value={rate}
                                                    onChange={(e) => handleRateChange(curr, e.target.value)}
                                                    step="0.0001"
                                                    className="bg-gray-900 border border-gray-700 rounded px-2 py-1 w-24 text-right outline-none focus:border-blue-500 text-sm"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Cash Balances Section */}
                            <div>
                                <h3 className="text-sm font-semibold text-gray-300 mb-2 border-b border-gray-700 pb-1">Cash Balances</h3>
                                <p className="text-xs text-gray-400 mb-2">Enter cash held in each currency</p>
                                <div className="space-y-2">
                                    {Object.entries(cashBalances).map(([curr, amount]) => (
                                        <div key={curr} className="flex items-center justify-between bg-gray-800 p-2 rounded">
                                            <span className="font-bold text-green-400 w-12">{curr}</span>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="number"
                                                    value={amount}
                                                    onChange={(e) => handleCashChange(curr, e.target.value)}
                                                    step="0.01"
                                                    className="bg-gray-900 border border-gray-700 rounded px-2 py-1 w-24 text-right outline-none focus:border-green-500 text-sm"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 flex justify-end flex-none pt-4 border-t border-gray-700">
                            <button
                                onClick={() => setShowSettings(false)}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-medium flex items-center gap-2"
                            >
                                <Save size={18} /> Done
                            </button>
                        </div>
                    </div>
                </div>
)}

            {/* Tax Settings Modal */}
            {showTaxSettings && (
                <TaxSettingsComponent
                    settings={taxSettings}
                    onSettingsChange={setTaxSettings}
                    onClose={() => setShowTaxSettings(false)}
                />
            )}
 
             {/* Header */}
            <div className="flex-none p-4 border-b border-gray-800 flex justify-between items-center bg-[#1a1a1a]">
                <h1 className="text-xl font-bold">Portfolio Analysis</h1>
                <div className="flex gap-4 items-center">
                    <div className="flex bg-gray-800 rounded-lg p-1 gap-1">
                        <button
                            onClick={() => exportToPDF(processedData as any, selectedYear)}
                            className="p-2 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
                            title="Export PDF"
                        >
                            <FileText size={18} />
                        </button>
                        <button
                            onClick={() => exportToExcel(processedData as any, selectedYear)}
                            className="p-2 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
                            title="Export Excel"
                        >
                            <TableIcon size={18} />
                        </button>
                    </div>

                    <button
                        onClick={handleFetchPrices}
                        disabled={fetchingPrices || Object.keys(data.open_positions).length === 0}
                        className="p-2 bg-gray-800 hover:bg-gray-700 disabled:bg-gray-900 disabled:cursor-not-allowed rounded text-gray-400 hover:text-white transition-colors flex items-center gap-2 text-sm"
                        title={pricesLastUpdated ? `Last updated: ${pricesLastUpdated.toLocaleTimeString()}` : 'Refresh stock prices'}
                    >
                        <RefreshCw size={16} className={fetchingPrices ? 'animate-spin' : ''} />
                        {fetchingPrices ? 'Updating...' : 'Refresh Prices'}
                    </button>

                     <button
                         onClick={() => setShowTaxSettings(true)}
                         className="p-2 bg-gray-800 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors flex items-center gap-2 text-sm"
                         title="Tax Settings"
                     >
                         <Calculator size={16} /> Tax
                     </button>

                     <button
                         onClick={() => setShowSettings(true)}
                         className="p-2 bg-gray-800 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors flex items-center gap-2 text-sm"
                         title="Settings"
                     >
                         <Settings size={16} /> Rates & Cash
                     </button>

                    <select
                        value={selectedCurrency}
                        onChange={(e) => setSelectedCurrency(e.target.value)}
                        className="bg-gray-800 text-white border border-gray-700 rounded px-3 py-1 outline-none focus:border-blue-500 text-sm"
                    >
                        {currencies.map(c => (
                            <option key={c} value={c}>{c}</option>
                        ))}
                    </select>

                    <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(e.target.value)}
                        className="bg-gray-800 text-white border border-gray-700 rounded px-3 py-1 outline-none focus:border-blue-500 text-sm"
                    >
                        <option value="All">All Time</option>
                        {years.map(y => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                    <button onClick={onReset} className="text-sm text-gray-400 hover:text-white underline">
                        Upload New
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col p-4 space-y-4">
                <div className="flex-none grid grid-cols-2 md:grid-cols-5 gap-4">
                    <KpiCard
                        title="Net Assets"
                        value={netAssets}
                        format={formatCurrency}
                        icon={<PieChart size={18} />}
                        color="amber"
                    />
                    <KpiCard
                        title="Net Profit"
                        value={processedData.net_profit}
                        format={formatCurrency}
                        icon={<DollarSign size={18} />}
                        color="emerald"
                        warnIfNegative
                    />
                    <KpiCard
                        title="Realized Profit"
                        value={processedData.total_realized_profit}
                        format={formatCurrency}
                        icon={<Activity size={18} />}
                        color="blue"
                    />
                    <KpiCard
                        title="Dividends"
                        value={processedData.total_dividends}
                        format={formatCurrency}
                        icon={<DollarSign size={18} />}
                        color="green"
                    />
                    <KpiCard
                        title="Fees"
                        value={processedData.total_fees_paid}
                        format={formatCurrency}
                        icon={<ArrowDownRight size={18} />}
                        color="purple"
                    />
                </div>

                {/* Performance Metrics Row */}
                {data.performance_metrics && (
                    <div className="flex-none grid grid-cols-2 md:grid-cols-4 gap-4">
                        <KpiCard
                            title="ROI"
                            value={`${data.performance_metrics.roi.toFixed(2)}%`}
                            icon={<TrendingUp size={18} />}
                            color="blue"
                            isCount
                        />
                        <KpiCard
                            title="Annualized Return"
                            value={`${data.performance_metrics.annualizedReturn.toFixed(2)}%`}
                            icon={<Target size={18} />}
                            color="emerald"
                            isCount
                        />
                        <KpiCard
                            title="Win Rate"
                            value={`${data.performance_metrics.winLossRatio.winRate.toFixed(1)}%`}
                            icon={<Award size={18} />}
                            color="green"
                            isCount
                        />
                        <KpiCard
                            title="Avg Hold Period"
                            value={`${Math.round(data.performance_metrics.averageHoldingPeriod)} days`}
                            icon={<Clock size={18} />}
                            color="purple"
                            isCount
                        />
                    </div>
                )}

                {/* Charts Area */}
                <div className="flex-none h-64 grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="bg-gray-900 rounded-lg p-3 border border-gray-800 flex flex-col">
                        <h3 className="text-sm font-semibold mb-2 text-gray-400">Cumulative Realized Profit ({selectedCurrency})</h3>
                        <div className="flex-1 min-h-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData}>
                                    <defs>
                                        <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                                    <XAxis dataKey="date" stroke="#666" fontSize={11} tickMargin={5} minTickGap={30} />
                                    <YAxis stroke="#666" fontSize={11} tickFormatter={(val) => `${val}`} width={40} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', fontSize: '12px' }}
                                        itemStyle={{ color: '#fff' }}
                                        formatter={(val: number | undefined) => [formatCurrency(val), "Profit"]}
                                    />
                                    <Area type="monotone" dataKey="cumulative" stroke="#10b981" fillOpacity={1} fill="url(#colorProfit)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="bg-gray-900 rounded-lg p-3 border border-gray-800 flex flex-col">
                        <h3 className="text-sm font-semibold mb-2 text-gray-400">Profit by Ticker (Top 20)</h3>
                        <div className="flex-1 min-h-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={tickerData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                                    <XAxis dataKey="ticker" stroke="#666" fontSize={11} />
                                    <YAxis stroke="#666" fontSize={11} tickFormatter={(val) => `${val}`} width={40} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', fontSize: '12px' }}
                                        itemStyle={{ color: '#fff' }}
                                        formatter={(val: number | undefined) => [formatCurrency(val), "Profit"]}
                                    />
                                    <Bar dataKey="profit" fill="#60a5fa" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* Data Tables with Tabs */}
                <div className="flex-1 bg-gray-900 rounded-lg border border-gray-800 flex flex-col min-h-0 overflow-hidden">
                    <div className="flex border-b border-gray-800">
                        <TabButton
                            active={activeTab === 'trades'}
                            onClick={() => setActiveTab('trades')}
                            label={`Closed Trades (${sortedTrades.length})`}
                        />
                        <TabButton
                            active={activeTab === 'positions'}
                            onClick={() => setActiveTab('positions')}
                            label={`Open Positions (${openPositionsSummary.length})`}
                        />
                        <TabButton
                            active={activeTab === 'dividends'}
                            onClick={() => setActiveTab('dividends')}
                            label={`Dividends (${processedData.dividends.length})`}
                        />
                        <TabButton
                            active={activeTab === 'fees'}
                            onClick={() => setActiveTab('fees')}
                            label={`Fees (${processedData.fees.length})`}
                        />
                        <TabButton
                             active={activeTab === 'performance'}
                             onClick={() => setActiveTab('performance')}
                             label="Performance"
                         />
                        <TabButton
                             active={activeTab === 'tax'}
                             onClick={() => setActiveTab('tax')}
                             label={`Tax (${data.taxCalculations ? Object.keys(data.taxCalculations).length : 0})`}
                         />
                         <TabButton
                              active={activeTab === 'alerts'}
                              onClick={() => setActiveTab('alerts')}
                              label="Alerts"
                         />

                         {activeTab === 'alerts' && (
                             <AlertManager 
                                 symbols={Array.from(new Set([
                                     ...data.closed_trades.map(t => t.ticker),
                                     ...Object.keys(data.open_positions)
                                 ]))}
                             />
                         )}

                          {activeTab === 'performance' && data.performance_metrics && (
                            <div className="p-4 space-y-6">
                                {/* Summary Stats */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-gray-800 rounded-lg p-4">
                                        <div className="text-gray-400 text-xs uppercase mb-1">Total Invested</div>
                                        <div className="text-2xl font-bold text-white">{formatCurrency(data.performance_metrics.totalInvested)}</div>
                                    </div>
                                    <div className="bg-gray-800 rounded-lg p-4">
                                        <div className="text-gray-400 text-xs uppercase mb-1">Current Value</div>
                                        <div className="text-2xl font-bold text-white">{formatCurrency(data.performance_metrics.currentValue)}</div>
                                    </div>
                                    <div className="bg-gray-800 rounded-lg p-4">
                                        <div className="text-gray-400 text-xs uppercase mb-1">Winning Trades</div>
                                        <div className="text-2xl font-bold text-green-400">{data.performance_metrics.winLossRatio.wins}</div>
                                    </div>
                                    <div className="bg-gray-800 rounded-lg p-4">
                                        <div className="text-gray-400 text-xs uppercase mb-1">Losing Trades</div>
                                        <div className="text-2xl font-bold text-red-400">{data.performance_metrics.winLossRatio.losses}</div>
                                    </div>
                                </div>

                                {/* Best Trades */}
                                <div>
                                    <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                                        <Award className="text-green-400" size={20} />
                                        Top 5 Best Trades
                                    </h3>
                                    <TableContainer>
                                        <TableHeader>
                                            <Th>Date</Th>
                                            <Th>Ticker</Th>
                                            <Th>Qty</Th>
                                            <Th>Sell Price</Th>
                                            <Th align="right">Profit ({selectedCurrency})</Th>
                                        </TableHeader>
                                        <tbody>
                                            {data.performance_metrics.bestTrades.map((t, i) => (
                                                <tr key={i} className="border-b border-gray-800 hover:bg-white/5 transition-colors">
                                                    <Td>{t.date.toLocaleDateString()}</Td>
                                                    <Td className="font-semibold text-blue-400">{t.ticker}</Td>
                                                    <Td>{t.quantity}</Td>
                                                    <Td>{formatCurrency(t.sell_price)}</Td>
                                                    <Td align="right" className="text-green-400 font-bold">
                                                        {formatCurrency(t.realized_profit)}
                                                    </Td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </TableContainer>
                                </div>

                                {/* Worst Trades */}
                                <div>
                                    <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                                        <AlertTriangle className="text-red-400" size={20} />
                                        Top 5 Worst Trades
                                    </h3>
                                    <TableContainer>
                                        <TableHeader>
                                            <Th>Date</Th>
                                            <Th>Ticker</Th>
                                            <Th>Qty</Th>
                                            <Th>Sell Price</Th>
                                            <Th align="right">Loss ({selectedCurrency})</Th>
                                        </TableHeader>
                                        <tbody>
                                            {[...processedData.closed_trades]
                                                .sort((a, b) => a.realized_profit - b.realized_profit)
                                                .slice(0, 5)
                                                .map((t, i) => (
                                                    <tr key={i} className="border-b border-gray-800 hover:bg-white/5 transition-colors">
                                                        <Td>{t.date.toLocaleDateString()}</Td>
                                                        <Td className="font-semibold text-blue-400">{t.ticker}</Td>
                                                        <Td>{t.quantity}</Td>
                                                        <Td>{formatCurrency(t.sell_price)}</Td>
                                                        <Td align="right" className="text-red-400 font-bold">
                                                            {formatCurrency(t.realized_profit)}
                                                        </Td>
                                                    </tr>
                                                ))}
                                        </tbody>
                                    </TableContainer>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// Sub-components for cleaner code
const KpiCard: React.FC<{ title: string; value: number | string; format?: (v: number) => string; icon: React.ReactNode; color: string; warnIfNegative?: boolean; isCount?: boolean }> = ({ title, value, format, icon, color, warnIfNegative, isCount }) => {
    // Tailwind dynamic classes for colors are tricky, using concrete map or just style.
    // Simplified for this example to reuse existing classes safely
    const colorClasses: Record<string, string> = {
        emerald: 'border-l-emerald-500 text-emerald-400 bg-emerald-500/10',
        blue: 'border-l-blue-500 text-blue-400 bg-blue-500/10',
        green: 'border-l-green-500 text-green-400 bg-green-500/10',
        purple: 'border-l-purple-500 text-purple-400 bg-purple-500/10',
        amber: 'border-l-amber-500 text-amber-400 bg-amber-500/10',
    };
    const c = colorClasses[color] || colorClasses['blue'];
    const valClass = warnIfNegative && typeof value === 'number' && value < 0 ? 'text-red-400' : 'text-white';

    return (
        <div className={`bg-gray-900 rounded-lg p-3 border-l-4 ${c.split(' ')[0]} border-t border-r border-b border-gray-800`}>
            <div className="flex items-center gap-2 mb-1">
                <div className={`p-1.5 rounded-lg ${c.split(' ').slice(1).join(' ')}`}>
                    {icon}
                </div>
                <span className="text-gray-400 text-xs font-medium uppercase tracking-wider">{title}</span>
            </div>
            <div className={`text-xl font-bold ${valClass}`}>
                {isCount ? value : (typeof value === 'number' && format ? format(value) : value)}
            </div>
        </div>
    );
};

const TabButton: React.FC<{ active: boolean; onClick: () => void; label: string }> = ({ active, onClick, label }) => (
    <button
        onClick={onClick}
        className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${active ? 'border-blue-500 text-white bg-gray-800/50' : 'border-transparent text-gray-400 hover:text-white hover:bg-white/5'
            }`}
    >
        {label}
    </button>
);

const TableContainer: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <table className="w-full text-left border-collapse relative">
        {children}
    </table>
);

const TableHeader: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <thead className="sticky top-0 bg-[#1a1a1a] z-10 shadow-sm">
        <tr className="text-gray-400 border-b border-gray-700">
            {children}
        </tr>
    </thead>
);

const Th: React.FC<{ children: React.ReactNode; align?: 'left' | 'right' }> = ({ children, align = 'left' }) => (
    <th className={`p-3 font-medium text-xs uppercase tracking-wider ${align === 'right' ? 'text-right' : 'text-left'}`}>
        {children}
    </th>
);

const Td: React.FC<{ children: React.ReactNode; align?: 'left' | 'right'; className?: string; colSpan?: number }> = ({ children, align = 'left', className = '', colSpan }) => (
    <td colSpan={colSpan} className={`p-3 text-sm text-gray-300 ${align === 'right' ? 'text-right' : 'text-left'} ${className}`}>
        {children}
    </td>
);
