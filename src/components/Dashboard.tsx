import React, { useEffect, useMemo, useState } from 'react';
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { Activity, ArrowDownRight, Clock, DollarSign, Download, PieChart, TrendingUp } from 'lucide-react';
import { exportToExcel, exportToPDF } from '../lib/export';
import { getCachedRates, getExchangeRates } from '../lib/exchange-rate-service';
import { fetchStockPrices, type StockPrice } from '../lib/price-service';
import { CalculationResult, ClosedTrade, Dividend, FeeRecord, Lot } from '../lib/types';
import { TaxDashboard } from './tax-optimization/TaxDashboard';
import { AlertManager } from './alerts/AlertManager';
import { SearchPanel } from './search/SearchPanel';

interface DashboardProps {
    data: CalculationResult;
    onReset: () => void;
}

type Tab = 'trades' | 'positions' | 'dividends' | 'fees' | 'performance' | 'tax' | 'alerts' | 'search';

type ProcessedData = {
    closed_trades: ClosedTrade[];
    open_positions: Record<string, Lot[]>;
    dividends: Dividend[];
    fees: FeeRecord[];
    total_realized_profit: number;
    total_dividends: number;
    total_fees_paid: number;
    net_profit: number;
};

type CurrencyBreakdown = Record<string, { realized_profit: number; dividends: number; fees_paid: number; net_profit: number }>;

const toDate = (value: Date | string | number): Date => {
    const d = value instanceof Date ? value : new Date(value);
    return Number.isNaN(d.getTime()) ? new Date() : d;
};

export const Dashboard: React.FC<DashboardProps> = ({ data, onReset }) => {
    const [activeTab, setActiveTab] = useState<Tab>('trades');
    const [selectedYear, setSelectedYear] = useState<string>('All');
    const [fetchingRates, setFetchingRates] = useState(false);
    const [ratesLastUpdated, setRatesLastUpdated] = useState<Date | null>(() => getCachedRates()?.lastUpdated ?? null);
    const [fetchingPrices, setFetchingPrices] = useState(false);
    const [pricesLastUpdated, setPricesLastUpdated] = useState<Date | null>(null);
    const [stockPrices, setStockPrices] = useState<Map<string, StockPrice>>(new Map());

    const [exchangeRates, setExchangeRates] = useState<Record<string, number>>(() => {
        const cached = getCachedRates();
        return cached?.rates ?? { USD: 1 };
    });

    const [cashBalances, setCashBalances] = useState<Record<string, number>>(data.calculated_cash_balances ?? {});

    useEffect(() => {
        setCashBalances(data.calculated_cash_balances ?? {});
    }, [data]);

    useEffect(() => {
        const syncRates = async () => {
            try {
                const result = await getExchangeRates('USD', false);
                if (!result.fromCache) {
                    setExchangeRates(result.rates);
                    setRatesLastUpdated(result.lastUpdated);
                }
            } catch (error) {
                console.error('Failed to sync exchange rates', error);
            }
        };

        syncRates();
    }, []);

    const currencies = useMemo(() => {
        const values = new Set<string>(['USD']);
        data.closed_trades.forEach((t) => values.add(t.currency));
        data.dividends.forEach((d) => values.add(d.currency));
        data.fees.forEach((f) => values.add(f.currency));
        Object.values(data.open_positions)
            .flat()
            .forEach((lot) => values.add(lot.currency));
        Object.keys(cashBalances).forEach((currency) => values.add(currency));
        Object.keys(exchangeRates).forEach((currency) => values.add(currency));

        return Array.from(values).sort();
    }, [cashBalances, data, exchangeRates]);

    const [selectedCurrency, setSelectedCurrency] = useState<string>('EUR');

    useEffect(() => {
        if (currencies.length > 0 && !currencies.includes(selectedCurrency)) {
            setSelectedCurrency(currencies[0]);
        }
    }, [currencies, selectedCurrency]);

    const years = useMemo(() => {
        const result = new Set<string>();

        data.closed_trades.forEach((t) => result.add(toDate(t.date).getFullYear().toString()));
        data.dividends.forEach((d) => result.add(toDate(d.date).getFullYear().toString()));
        data.fees.forEach((f) => result.add(toDate(f.date).getFullYear().toString()));

        return Array.from(result).sort((a, b) => Number(b) - Number(a));
    }, [data]);

    const convert = (amount: number, from: string, to: string): number => {
        if (from === to) return amount;
        const fromRate = exchangeRates[from] ?? 1;
        const toRate = exchangeRates[to] ?? 1;
        return (amount / fromRate) * toRate;
    };

    const rawYearFilteredData = useMemo(() => {
        const year = selectedYear === 'All' ? null : Number(selectedYear);

        const closed = data.closed_trades.filter((t) => year === null || toDate(t.date).getFullYear() === year);
        const dividends = data.dividends.filter((d) => year === null || toDate(d.date).getFullYear() === year);
        const fees = data.fees.filter((f) => year === null || toDate(f.date).getFullYear() === year);

        return { closed, dividends, fees };
    }, [data, selectedYear]);

    const processedData = useMemo<ProcessedData>(() => {
        const closed_trades = rawYearFilteredData.closed.map((t) => ({
            ...t,
            date: toDate(t.date),
            sell_price: convert(t.sell_price, t.currency, selectedCurrency),
            sell_fees: convert(t.sell_fees, t.currency, selectedCurrency),
            cost_basis: convert(t.cost_basis, t.currency, selectedCurrency),
            realized_profit: convert(t.realized_profit, t.currency, selectedCurrency),
            sale_proceeds: convert(t.sale_proceeds, t.currency, selectedCurrency),
            currency: selectedCurrency,
        }));

        const dividends = rawYearFilteredData.dividends.map((d) => ({
            ...d,
            date: toDate(d.date),
            amount: convert(d.amount, d.currency, selectedCurrency),
            currency: selectedCurrency,
        }));

        const fees = rawYearFilteredData.fees.map((f) => ({
            ...f,
            date: toDate(f.date),
            amount: convert(f.amount, f.currency, selectedCurrency),
            currency: selectedCurrency,
        }));

        const open_positions: Record<string, Lot[]> = {};
        Object.entries(data.open_positions).forEach(([ticker, lots]) => {
            open_positions[ticker] = lots.map((lot) => ({
                ...lot,
                date: toDate(lot.date),
                unit_cost: convert(lot.unit_cost, lot.currency, selectedCurrency),
                price_paid: convert(lot.price_paid, lot.currency, selectedCurrency),
                fees_paid: convert(lot.fees_paid, lot.currency, selectedCurrency),
                market_price: lot.market_price !== undefined
                    ? convert(lot.market_price, lot.currency, selectedCurrency)
                    : undefined,
                currency: selectedCurrency,
            }));
        });

        const total_realized_profit = closed_trades.reduce((sum, t) => sum + t.realized_profit, 0);
        const total_dividends = dividends.reduce((sum, d) => sum + d.amount, 0);
        const total_fees_paid = fees.reduce((sum, f) => sum + f.amount, 0);

        return {
            closed_trades,
            open_positions,
            dividends,
            fees,
            total_realized_profit,
            total_dividends,
            total_fees_paid,
            net_profit: total_realized_profit - total_fees_paid + total_dividends,
        };
    }, [data.open_positions, rawYearFilteredData, selectedCurrency, exchangeRates]);

    const currencyBreakdown = useMemo<CurrencyBreakdown>(() => {
        const breakdown: CurrencyBreakdown = {};

        const init = (currency: string) => {
            if (!breakdown[currency]) {
                breakdown[currency] = { realized_profit: 0, dividends: 0, fees_paid: 0, net_profit: 0 };
            }
        };

        rawYearFilteredData.closed.forEach((t) => {
            init(t.currency);
            breakdown[t.currency].realized_profit += t.realized_profit;
        });

        rawYearFilteredData.dividends.forEach((d) => {
            init(d.currency);
            breakdown[d.currency].dividends += d.amount;
        });

        rawYearFilteredData.fees.forEach((f) => {
            init(f.currency);
            breakdown[f.currency].fees_paid += f.amount;
        });

        Object.values(breakdown).forEach((row) => {
            row.net_profit = row.realized_profit - row.fees_paid + row.dividends;
        });

        return breakdown;
    }, [rawYearFilteredData]);

    const openPositionsSummary = useMemo(() => {
        return Object.entries(processedData.open_positions)
            .map(([ticker, lots]) => {
                const quantity = lots.reduce((sum, lot) => sum + lot.quantity, 0);
                const totalCost = lots.reduce((sum, lot) => sum + lot.quantity * lot.unit_cost, 0);

                const live = stockPrices.get(ticker);
                const currentPrice = live
                    ? convert(live.price, live.currency, selectedCurrency)
                    : (lots.reduce((sum, lot) => sum + (lot.market_price ?? lot.unit_cost), 0) / Math.max(lots.length, 1));

                const marketValue = quantity * currentPrice;

                return {
                    ticker,
                    quantity,
                    avgCost: quantity ? totalCost / quantity : 0,
                    totalCost,
                    marketValue,
                    unrealized: marketValue - totalCost,
                    currentPrice,
                    hasLivePrice: !!live,
                };
            })
            .sort((a, b) => a.ticker.localeCompare(b.ticker));
    }, [processedData.open_positions, stockPrices, selectedCurrency, exchangeRates]);

    const totalMarketValue = openPositionsSummary.reduce((sum, p) => sum + p.marketValue, 0);

    const totalCashValue = useMemo(() => {
        return Object.entries(cashBalances).reduce((sum, [currency, amount]) => {
            return sum + convert(amount, currency, selectedCurrency);
        }, 0);
    }, [cashBalances, selectedCurrency, exchangeRates]);

    const netAssets = totalMarketValue + totalCashValue;

    const handleFetchRates = async () => {
        setFetchingRates(true);
        try {
            const result = await getExchangeRates('USD', true);
            setExchangeRates(result.rates);
            setRatesLastUpdated(result.lastUpdated);
        } catch (error) {
            console.error('Failed to refresh rates', error);
            alert('Failed to fetch exchange rates.');
        } finally {
            setFetchingRates(false);
        }
    };

    const handleFetchPrices = async () => {
        const symbols = Object.keys(data.open_positions);
        if (symbols.length === 0) return;

        setFetchingPrices(true);
        try {
            const prices = await fetchStockPrices(symbols);
            setStockPrices(prices);
            setPricesLastUpdated(new Date());
        } catch (error) {
            console.error('Failed to fetch stock prices', error);
            alert('Failed to fetch stock prices.');
        } finally {
            setFetchingPrices(false);
        }
    };

    const formatCurrency = (value: number, currencyOverride?: string): string => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currencyOverride ?? selectedCurrency,
            maximumFractionDigits: 2,
        }).format(value);
    };

    const exportCurrentView = (format: 'pdf' | 'excel') => {
        const exportData: CalculationResult = {
            ...data,
            closed_trades: processedData.closed_trades,
            open_positions: processedData.open_positions,
            total_realized_profit: processedData.total_realized_profit,
            total_dividends: processedData.total_dividends,
            total_fees_paid: processedData.total_fees_paid,
            net_profit: processedData.net_profit,
            dividends: processedData.dividends,
            fees: processedData.fees,
            cash_transactions: data.cash_transactions.map((t) => ({
                ...t,
                date: toDate(t.date),
                amount: convert(t.amount, t.currency, selectedCurrency),
                currency: selectedCurrency,
            })),
            calculated_cash_balances: { [selectedCurrency]: totalCashValue },
            totals_by_currency: {
                [selectedCurrency]: {
                    realized_profit: processedData.total_realized_profit,
                    dividends: processedData.total_dividends,
                    fees_paid: processedData.total_fees_paid,
                    net_profit: processedData.net_profit,
                },
            },
            openPositionsSource: data.openPositionsSource,
        };

        if (format === 'pdf') {
            exportToPDF(exportData, selectedYear);
        } else {
            exportToExcel(exportData, selectedYear);
        }
    };

    const sortedTrades = [...processedData.closed_trades].sort((a, b) => toDate(b.date).getTime() - toDate(a.date).getTime());
    const chartData = useMemo(() => {
        let cumulative = 0;
        return [...processedData.closed_trades]
            .sort((a, b) => toDate(a.date).getTime() - toDate(b.date).getTime())
            .map((trade) => {
                cumulative += trade.realized_profit;
                return {
                    date: toDate(trade.date).toLocaleDateString(),
                    cumulative,
                };
            });
    }, [processedData.closed_trades]);

    const tickerData = useMemo(() => {
        const map = new Map<string, number>();
        processedData.closed_trades.forEach((trade) => {
            map.set(trade.ticker, (map.get(trade.ticker) ?? 0) + trade.realized_profit);
        });
        return [...map.entries()]
            .map(([ticker, profit]) => ({ ticker, profit }))
            .sort((a, b) => b.profit - a.profit)
            .slice(0, 20);
    }, [processedData.closed_trades]);

    const bestTrades = useMemo(
        () => [...processedData.closed_trades].sort((a, b) => b.realized_profit - a.realized_profit).slice(0, 5),
        [processedData.closed_trades],
    );

    const worstTrades = useMemo(
        () => [...processedData.closed_trades].sort((a, b) => a.realized_profit - b.realized_profit).slice(0, 5),
        [processedData.closed_trades],
    );

    const symbolsForAlerts = useMemo(
        () => Array.from(new Set([...data.closed_trades.map((t) => t.ticker), ...Object.keys(data.open_positions)])),
        [data],
    );

    return (
        <div className="h-screen overflow-hidden bg-[#121212] text-white flex flex-col">
            <div className="border-b border-gray-800 px-4 py-3 flex flex-wrap items-center gap-3">
                <h1 className="text-lg font-semibold">Freedom24 Dashboard</h1>

                <div className="flex items-center gap-2 ml-auto">
                    <label className="text-sm text-gray-400">Year</label>
                    <select
                        value={selectedYear}
                        onChange={(event) => setSelectedYear(event.target.value)}
                        className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm"
                    >
                        <option value="All">All</option>
                        {years.map((year) => (
                            <option key={year} value={year}>{year}</option>
                        ))}
                    </select>
                </div>

                <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-400">Currency</label>
                    <select
                        value={selectedCurrency}
                        onChange={(event) => setSelectedCurrency(event.target.value)}
                        className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm"
                    >
                        {currencies.map((currency) => (
                            <option key={currency} value={currency}>{currency}</option>
                        ))}
                    </select>
                </div>

                <button
                    onClick={handleFetchRates}
                    disabled={fetchingRates}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:cursor-not-allowed rounded text-sm"
                >
                    {fetchingRates ? 'Updating rates...' : 'Update Rates'}
                </button>

                <button
                    onClick={handleFetchPrices}
                    disabled={fetchingPrices || Object.keys(data.open_positions).length === 0}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:cursor-not-allowed rounded text-sm"
                >
                    {fetchingPrices ? 'Updating prices...' : 'Update Prices'}
                </button>

                <button
                    onClick={() => exportCurrentView('pdf')}
                    className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-sm flex items-center gap-2"
                >
                    <Download size={14} /> Export PDF
                </button>

                <button
                    onClick={() => exportCurrentView('excel')}
                    className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-sm flex items-center gap-2"
                >
                    <Download size={14} /> Export Excel
                </button>

                <button
                    onClick={onReset}
                    className="px-3 py-1.5 bg-red-700 hover:bg-red-600 rounded text-sm"
                >
                    Upload New
                </button>
            </div>

            <div className="px-4 py-2 text-xs text-gray-500 border-b border-gray-800">
                Rates source base: USD
                {ratesLastUpdated ? ` | Last updated: ${ratesLastUpdated.toLocaleString()}` : ''}
                {pricesLastUpdated ? ` | Prices updated: ${pricesLastUpdated.toLocaleString()}` : ''}
            </div>

            <div className="p-4 space-y-4 overflow-auto">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <KpiCard title="Net Assets" value={formatCurrency(netAssets)} icon={<PieChart size={16} />} tone="amber" />
                    <KpiCard title="Net Profit" value={formatCurrency(processedData.net_profit)} icon={<DollarSign size={16} />} tone={processedData.net_profit >= 0 ? 'green' : 'red'} />
                    <KpiCard title="Realized Profit" value={formatCurrency(processedData.total_realized_profit)} icon={<Activity size={16} />} tone="blue" />
                    <KpiCard title="Dividend Income" value={formatCurrency(processedData.total_dividends)} icon={<DollarSign size={16} />} tone="emerald" />
                    <KpiCard title="Fees" value={formatCurrency(processedData.total_fees_paid)} icon={<ArrowDownRight size={16} />} tone="purple" />
                </div>

                {data.performance_metrics && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <KpiCard title="ROI" value={`${data.performance_metrics.roi.toFixed(2)}%`} icon={<TrendingUp size={16} />} tone="blue" />
                        <KpiCard title="Annualized" value={`${data.performance_metrics.annualizedReturn.toFixed(2)}%`} icon={<TrendingUp size={16} />} tone="emerald" />
                        <KpiCard title="Win Rate" value={`${data.performance_metrics.winLossRatio.winRate.toFixed(1)}%`} icon={<TrendingUp size={16} />} tone="green" />
                        <KpiCard title="Avg Hold" value={`${Math.round(data.performance_metrics.averageHoldingPeriod)} days`} icon={<Clock size={16} />} tone="purple" />
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="bg-gray-900 border border-gray-800 rounded-lg p-3 h-64 flex flex-col">
                        <h3 className="text-sm font-semibold text-gray-300 mb-2">Cumulative Realized Profit</h3>
                        <div className="flex-1 min-h-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData}>
                                    <defs>
                                        <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                                    <XAxis dataKey="date" stroke="#666" fontSize={11} minTickGap={20} />
                                    <YAxis stroke="#666" fontSize={11} tickFormatter={(v) => `${v}`} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                                        formatter={(value: number | undefined) => [formatCurrency(value ?? 0), 'Cumulative']}
                                    />
                                    <Area type="monotone" dataKey="cumulative" stroke="#10b981" fill="url(#profitGradient)" strokeWidth={2} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="bg-gray-900 border border-gray-800 rounded-lg p-3 h-64 flex flex-col">
                        <h3 className="text-sm font-semibold text-gray-300 mb-2">Profit by Ticker (Top 20)</h3>
                        <div className="flex-1 min-h-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={tickerData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                                    <XAxis dataKey="ticker" stroke="#666" fontSize={11} />
                                    <YAxis stroke="#666" fontSize={11} tickFormatter={(v) => `${v}`} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                                        formatter={(value: number | undefined) => [formatCurrency(value ?? 0), 'Profit']}
                                    />
                                    <Bar dataKey="profit" fill="#60a5fa" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                    <h2 className="text-sm font-semibold text-gray-300 mb-3">Totals By Currency ({selectedYear})</h2>
                    {Object.keys(currencyBreakdown).length === 0 ? (
                        <p className="text-sm text-gray-500">No rows for this selection.</p>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                            {Object.entries(currencyBreakdown).map(([currency, row]) => (
                                <div key={currency} className="bg-gray-800 border border-gray-700 rounded p-3">
                                    <div className="text-xs text-blue-400 font-semibold mb-1">{currency}</div>
                                    <div className="text-xs text-gray-400">Realized: {formatCurrency(row.realized_profit, currency)}</div>
                                    <div className="text-xs text-gray-400">Dividends: {formatCurrency(row.dividends, currency)}</div>
                                    <div className="text-xs text-gray-400">Fees: {formatCurrency(row.fees_paid, currency)}</div>
                                    <div className={`text-sm font-semibold mt-1 ${row.net_profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                        Net: {formatCurrency(row.net_profit, currency)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
                    <div className="border-b border-gray-800 px-3 flex gap-2 flex-wrap">
                        <TabButton active={activeTab === 'trades'} onClick={() => setActiveTab('trades')} label={`Closed Trades (${sortedTrades.length})`} />
                        <TabButton active={activeTab === 'positions'} onClick={() => setActiveTab('positions')} label={`Open Positions (${openPositionsSummary.length})`} />
                        <TabButton active={activeTab === 'dividends'} onClick={() => setActiveTab('dividends')} label={`Dividends (${processedData.dividends.length})`} />
                        <TabButton active={activeTab === 'fees'} onClick={() => setActiveTab('fees')} label={`Fees (${processedData.fees.length})`} />
                        <TabButton active={activeTab === 'performance'} onClick={() => setActiveTab('performance')} label="Performance" />
                        <TabButton active={activeTab === 'tax'} onClick={() => setActiveTab('tax')} label="Tax" />
                        <TabButton active={activeTab === 'alerts'} onClick={() => setActiveTab('alerts')} label={`Alerts (${symbolsForAlerts.length})`} />
                        <TabButton active={activeTab === 'search'} onClick={() => setActiveTab('search')} label="Search" />
                    </div>

                    {(activeTab === 'tax' || activeTab === 'alerts' || activeTab === 'search') ? (
                        <div className="h-[65vh]">
                            {activeTab === 'tax' && <TaxDashboard data={data} />}
                            {activeTab === 'alerts' && <AlertManager symbols={symbolsForAlerts} />}
                            {activeTab === 'search' && <SearchPanel data={data} />}
                        </div>
                    ) : (
                        <div className="max-h-[55vh] overflow-auto">
                        {activeTab === 'trades' && (
                            <Table>
                                <thead>
                                    <tr className="text-gray-400 border-b border-gray-800 text-xs uppercase">
                                        <Th>Date</Th>
                                        <Th>Ticker</Th>
                                        <Th>Qty</Th>
                                        <Th align="right">Sell Price</Th>
                                        <Th align="right">Cost Basis</Th>
                                        <Th align="right">Profit</Th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedTrades.map((trade, idx) => (
                                        <tr key={`${trade.ticker}-${idx}`} className="border-b border-gray-800/70 hover:bg-white/5">
                                            <Td>{toDate(trade.date).toLocaleDateString()}</Td>
                                            <Td className="font-semibold text-blue-300">{trade.ticker}</Td>
                                            <Td>{trade.quantity}</Td>
                                            <Td align="right">{formatCurrency(trade.sell_price)}</Td>
                                            <Td align="right">{formatCurrency(trade.cost_basis)}</Td>
                                            <Td align="right" className={trade.realized_profit >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                                                {formatCurrency(trade.realized_profit)}
                                            </Td>
                                        </tr>
                                    ))}
                                    {sortedTrades.length === 0 && (
                                        <tr><Td colSpan={6} className="text-center text-gray-500 py-6">No closed trades.</Td></tr>
                                    )}
                                </tbody>
                            </Table>
                        )}

                        {activeTab === 'positions' && (
                            <Table>
                                <thead>
                                    <tr className="text-gray-400 border-b border-gray-800 text-xs uppercase">
                                        <Th>Ticker</Th>
                                        <Th>Qty</Th>
                                        <Th align="right">Current Price</Th>
                                        <Th align="right">Avg Cost</Th>
                                        <Th align="right">Total Cost</Th>
                                        <Th align="right">Market Value</Th>
                                        <Th align="right">Unrealized</Th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {openPositionsSummary.map((position) => (
                                        <tr key={position.ticker} className="border-b border-gray-800/70 hover:bg-white/5">
                                            <Td className="font-semibold text-blue-300">{position.ticker}</Td>
                                            <Td>{position.quantity}</Td>
                                            <Td align="right" className={position.hasLivePrice ? 'text-emerald-300' : 'text-gray-300'}>
                                                {formatCurrency(position.currentPrice)}
                                            </Td>
                                            <Td align="right">{formatCurrency(position.avgCost)}</Td>
                                            <Td align="right">{formatCurrency(position.totalCost)}</Td>
                                            <Td align="right">{formatCurrency(position.marketValue)}</Td>
                                            <Td align="right" className={position.unrealized >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                                                {formatCurrency(position.unrealized)}
                                            </Td>
                                        </tr>
                                    ))}
                                    {openPositionsSummary.length === 0 && (
                                        <tr><Td colSpan={7} className="text-center text-gray-500 py-6">No open positions.</Td></tr>
                                    )}
                                </tbody>
                            </Table>
                        )}

                        {activeTab === 'dividends' && (
                            <Table>
                                <thead>
                                    <tr className="text-gray-400 border-b border-gray-800 text-xs uppercase">
                                        <Th>Date</Th>
                                        <Th>Description</Th>
                                        <Th align="right">Amount</Th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {[...processedData.dividends]
                                        .sort((a, b) => toDate(b.date).getTime() - toDate(a.date).getTime())
                                        .map((dividend, idx) => (
                                            <tr key={idx} className="border-b border-gray-800/70 hover:bg-white/5">
                                                <Td>{toDate(dividend.date).toLocaleDateString()}</Td>
                                                <Td>{dividend.description || 'Dividend'}</Td>
                                                <Td align="right" className="text-emerald-400">{formatCurrency(dividend.amount)}</Td>
                                            </tr>
                                        ))}
                                    {processedData.dividends.length === 0 && (
                                        <tr><Td colSpan={3} className="text-center text-gray-500 py-6">No dividends.</Td></tr>
                                    )}
                                </tbody>
                            </Table>
                        )}

                        {activeTab === 'fees' && (
                            <Table>
                                <thead>
                                    <tr className="text-gray-400 border-b border-gray-800 text-xs uppercase">
                                        <Th>Date</Th>
                                        <Th>Description</Th>
                                        <Th align="right">Amount</Th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {[...processedData.fees]
                                        .sort((a, b) => toDate(b.date).getTime() - toDate(a.date).getTime())
                                        .map((fee, idx) => (
                                            <tr key={idx} className="border-b border-gray-800/70 hover:bg-white/5">
                                                <Td>{toDate(fee.date).toLocaleDateString()}</Td>
                                                <Td>{fee.description || 'Fee'}</Td>
                                                <Td align="right" className="text-rose-400">{formatCurrency(fee.amount)}</Td>
                                            </tr>
                                        ))}
                                    {processedData.fees.length === 0 && (
                                        <tr><Td colSpan={3} className="text-center text-gray-500 py-6">No fees.</Td></tr>
                                    )}
                                </tbody>
                            </Table>
                        )}

                        {activeTab === 'performance' && (
                            <div className="p-4 space-y-6">
                                {data.performance_metrics ? (
                                    <>
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

                                        <div>
                                            <h3 className="text-lg font-semibold text-white mb-3">Top 5 Best Trades</h3>
                                            <Table>
                                                <thead>
                                                    <tr className="text-gray-400 border-b border-gray-800 text-xs uppercase">
                                                        <Th>Date</Th>
                                                        <Th>Ticker</Th>
                                                        <Th>Qty</Th>
                                                        <Th align="right">Sell Price</Th>
                                                        <Th align="right">Profit</Th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {bestTrades.map((trade, idx) => (
                                                        <tr key={idx} className="border-b border-gray-800/70 hover:bg-white/5">
                                                            <Td>{toDate(trade.date).toLocaleDateString()}</Td>
                                                            <Td className="font-semibold text-blue-300">{trade.ticker}</Td>
                                                            <Td>{trade.quantity}</Td>
                                                            <Td align="right">{formatCurrency(trade.sell_price)}</Td>
                                                            <Td align="right" className="text-emerald-400">{formatCurrency(trade.realized_profit)}</Td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </Table>
                                        </div>

                                        <div>
                                            <h3 className="text-lg font-semibold text-white mb-3">Top 5 Worst Trades</h3>
                                            <Table>
                                                <thead>
                                                    <tr className="text-gray-400 border-b border-gray-800 text-xs uppercase">
                                                        <Th>Date</Th>
                                                        <Th>Ticker</Th>
                                                        <Th>Qty</Th>
                                                        <Th align="right">Sell Price</Th>
                                                        <Th align="right">Loss</Th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {worstTrades.map((trade, idx) => (
                                                        <tr key={idx} className="border-b border-gray-800/70 hover:bg-white/5">
                                                            <Td>{toDate(trade.date).toLocaleDateString()}</Td>
                                                            <Td className="font-semibold text-blue-300">{trade.ticker}</Td>
                                                            <Td>{trade.quantity}</Td>
                                                            <Td align="right">{formatCurrency(trade.sell_price)}</Td>
                                                            <Td align="right" className="text-red-400">{formatCurrency(trade.realized_profit)}</Td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </Table>
                                        </div>
                                    </>
                                ) : (
                                    <div className="text-sm text-gray-500">Performance metrics are not available for this dataset.</div>
                                )}
                            </div>
                        )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const KpiCard: React.FC<{ title: string; value: string; icon: React.ReactNode; tone: 'amber' | 'green' | 'red' | 'blue' | 'emerald' | 'purple' }> = ({ title, value, icon, tone }) => {
    const toneClasses: Record<string, string> = {
        amber: 'text-amber-300 border-amber-500/30',
        green: 'text-green-300 border-green-500/30',
        red: 'text-red-300 border-red-500/30',
        blue: 'text-blue-300 border-blue-500/30',
        emerald: 'text-emerald-300 border-emerald-500/30',
        purple: 'text-purple-300 border-purple-500/30',
    };

    return (
        <div className={`bg-gray-900 border rounded-lg p-3 ${toneClasses[tone]}`}>
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-400">
                {icon}
                {title}
            </div>
            <div className="text-xl font-semibold mt-2 text-white">{value}</div>
        </div>
    );
};

const TabButton: React.FC<{ active: boolean; onClick: () => void; label: string }> = ({ active, onClick, label }) => (
    <button
        onClick={onClick}
        className={`px-3 py-2 text-sm border-b-2 ${active ? 'border-blue-500 text-white' : 'border-transparent text-gray-400 hover:text-white'}`}
    >
        {label}
    </button>
);

const Table: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <table className="w-full text-sm">{children}</table>
);

const Th: React.FC<{ children: React.ReactNode; align?: 'left' | 'right' }> = ({ children, align = 'left' }) => (
    <th className={`px-3 py-2 ${align === 'right' ? 'text-right' : 'text-left'}`}>{children}</th>
);

const Td: React.FC<{ children: React.ReactNode; align?: 'left' | 'right'; className?: string; colSpan?: number }> = ({ children, align = 'left', className = '', colSpan }) => (
    <td colSpan={colSpan} className={`px-3 py-2 text-gray-200 ${align === 'right' ? 'text-right' : 'text-left'} ${className}`}>{children}</td>
);
