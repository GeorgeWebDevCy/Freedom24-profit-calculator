
import React from 'react';
import { CalculationResult } from '../lib/types';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { ArrowDownRight, DollarSign, PieChart, Activity } from 'lucide-react';

interface DashboardProps {
    data: CalculationResult;
    onReset: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ data, onReset }) => {
    // Sort closed trades by date
    const sortedTrades = [...data.closed_trades].sort((a, b) => a.date.getTime() - b.date.getTime());

    let cumulative = 0;
    const chartData = sortedTrades.map(t => {
        cumulative += t.realized_profit;
        return {
            date: t.date.toLocaleDateString(),
            profit: t.realized_profit,
            cumulative: cumulative
        };
    });

    const profitByTicker = new Map<string, number>();
    for (const trade of data.closed_trades) {
        profitByTicker.set(trade.ticker, (profitByTicker.get(trade.ticker) || 0) + trade.realized_profit);
    }
    const tickerData = [...profitByTicker.entries()].map(([ticker, profit]) => ({
        ticker,
        profit,
    }));

    const openPositions = Object.entries(data.open_positions).map(([ticker, lots]) => {
        const totalQty = lots.reduce((sum, lot) => sum + lot.quantity, 0);
        const totalCost = lots.reduce((sum, lot) => sum + lot.quantity * lot.unit_cost, 0);
        const avgCost = totalQty > 0 ? totalCost / totalQty : 0;
        return {
            ticker,
            quantity: totalQty,
            avg_cost: avgCost,
            total_cost: totalCost,
        };
    }).sort((a, b) => a.ticker.localeCompare(b.ticker));

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(val);
    };

    return (
        <div className="h-full flex flex-col p-6 space-y-6 overflow-auto">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-white">Portfolio Analysis</h1>
                <button onClick={onReset} className="text-sm text-gray-400 hover:text-white underline">
                    Upload New Files
                </button>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="card border-l-4 border-l-emerald-500">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-400">
                            <DollarSign size={20} />
                        </div>
                        <span className="text-gray-400 text-sm">Net Profit</span>
                    </div>
                    <div className={`text-3xl font-bold ${data.net_profit >= 0 ? 'text-white' : 'text-red-400'}`}>
                        {formatCurrency(data.net_profit)}
                    </div>
                </div>

                <div className="card border-l-4 border-l-blue-500">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
                            <Activity size={20} />
                        </div>
                        <span className="text-gray-400 text-sm">Realized Profit (Gross)</span>
                    </div>
                    <div className="text-3xl font-bold text-white">
                        {formatCurrency(data.total_realized_profit)}
                    </div>
                </div>

                <div className="card border-l-4 border-l-purple-500">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-purple-500/20 rounded-lg text-purple-400">
                            <ArrowDownRight size={20} />
                        </div>
                        <span className="text-gray-400 text-sm">Standalone Fees</span>
                    </div>
                    <div className="text-3xl font-bold text-white">
                        {formatCurrency(data.total_fees_paid)}
                    </div>
                </div>

                <div className="card border-l-4 border-l-amber-500">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-amber-500/20 rounded-lg text-amber-400">
                            <PieChart size={20} />
                        </div>
                        <span className="text-gray-400 text-sm">Open Positions</span>
                    </div>
                    <div className="text-3xl font-bold text-white">
                        {Object.keys(data.open_positions).length}
                    </div>
                </div>
            </div>

            {/* Chart */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="card h-80 flex flex-col">
                    <h3 className="text-lg font-semibold mb-4 text-gray-300">Cumulative Realized Profit</h3>
                    <div className="flex-1 w-full min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                                <XAxis dataKey="date" stroke="#666" fontSize={12} tickMargin={10} />
                                <YAxis stroke="#666" fontSize={12} tickFormatter={(val) => `$${val}`} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                                    itemStyle={{ color: '#fff' }}
                                />
                                <Area type="monotone" dataKey="cumulative" stroke="#10b981" fillOpacity={1} fill="url(#colorProfit)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="card h-80 flex flex-col">
                    <h3 className="text-lg font-semibold mb-4 text-gray-300">Profit by Ticker</h3>
                    <div className="flex-1 w-full min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={tickerData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                                <XAxis dataKey="ticker" stroke="#666" fontSize={12} />
                                <YAxis stroke="#666" fontSize={12} tickFormatter={(val) => `$${val}`} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                                    itemStyle={{ color: '#fff' }}
                                />
                                <Bar dataKey="profit" fill="#60a5fa" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Trades Table */}
            <div className="card overflow-hidden flex flex-col flex-1 min-h-0">
                <h3 className="text-lg font-semibold mb-4 text-gray-300">Closed Trades</h3>
                <div className="overflow-auto flex-1">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="text-gray-400 border-b border-gray-700">
                                <th className="p-3 font-medium">Date</th>
                                <th className="p-3 font-medium">Ticker</th>
                                <th className="p-3 font-medium">Qty</th>
                                <th className="p-3 font-medium">Sell Price</th>
                                <th className="p-3 font-medium">Cost Basis</th>
                                <th className="p-3 font-medium text-right">Profit</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedTrades.map((t, i) => (
                                <tr key={i} className="border-b border-gray-800 hover:bg-white/5 transition-colors">
                                    <td className="p-3 text-sm text-gray-300">{t.date.toLocaleDateString()}</td>
                                    <td className="p-3 font-semibold text-blue-400">{t.ticker}</td>
                                    <td className="p-3 text-sm text-gray-300">{t.quantity}</td>
                                    <td className="p-3 text-sm text-gray-300">{formatCurrency(t.sell_price)}</td>
                                    <td className="p-3 text-sm text-gray-300">{formatCurrency(t.cost_basis)}</td>
                                    <td className={`p-3 text-right font-medium ${t.realized_profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {formatCurrency(t.realized_profit)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Open Positions */}
            <div className="card overflow-hidden flex flex-col flex-1 min-h-0">
                <h3 className="text-lg font-semibold mb-4 text-gray-300">Open Positions</h3>
                <div className="overflow-auto flex-1">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="text-gray-400 border-b border-gray-700">
                                <th className="p-3 font-medium">Ticker</th>
                                <th className="p-3 font-medium">Quantity</th>
                                <th className="p-3 font-medium">Avg Cost</th>
                                <th className="p-3 font-medium">Total Cost</th>
                            </tr>
                        </thead>
                        <tbody>
                            {openPositions.length === 0 && (
                                <tr>
                                    <td className="p-3 text-sm text-gray-400" colSpan={4}>
                                        No open positions.
                                    </td>
                                </tr>
                            )}
                            {openPositions.map((pos) => (
                                <tr key={pos.ticker} className="border-b border-gray-800 hover:bg-white/5 transition-colors">
                                    <td className="p-3 font-semibold text-blue-400">{pos.ticker}</td>
                                    <td className="p-3 text-sm text-gray-300">{pos.quantity}</td>
                                    <td className="p-3 text-sm text-gray-300">{formatCurrency(pos.avg_cost)}</td>
                                    <td className="p-3 text-sm text-gray-300">{formatCurrency(pos.total_cost)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
