import React, { useState, useEffect } from 'react';
import { 
    TaxCalculation, 
    TaxOptimization, 
    TaxSettings, 
    HarvestingOpportunity,
    WashSaleWarning,
    CalculationResult 
} from '../../lib/types';
import { TaxCalculatorService } from '../../lib/services/tax-calculator.service';
import { TaxOptimizationService } from '../../lib/services/tax-optimization.service';
import { 
    PieChart, 
    Pie,
    BarChart, 
    Bar, 
    XAxis, 
    YAxis, 
    CartesianGrid, 
    Tooltip, 
    ResponsiveContainer,
    Cell 
} from 'recharts';
import { 
    Calculator, 
    TrendingUp, 
    AlertTriangle, 
    Target, 
    Settings, 
    Download,
    RefreshCw,
    DollarSign,
    Shield,
    Clock
} from 'lucide-react';

interface TaxDashboardProps {
    data: CalculationResult;
    onRefresh?: () => void;
}

export const TaxDashboard: React.FC<TaxDashboardProps> = ({ data, onRefresh }) => {
    const [taxSettings, setTaxSettings] = useState<TaxSettings>(() => ({
        residencies: TaxCalculatorService.getDefaultTaxResidencies(),
        defaultCurrency: 'USD',
        optimizationEnabled: true,
        harvestThreshold: 1000,
        washSaleEnabled: true,
        taxLossCarryforwardEnabled: true
    }));

    const [taxCalculations, setTaxCalculations] = useState<Record<number, TaxCalculation>>({});
    const [taxOptimizations, setTaxOptimizations] = useState<TaxOptimization[]>([]);
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [loading, setLoading] = useState(false);
    const [showSettings, setShowSettings] = useState(false);

    const taxCalculator = new TaxCalculatorService();
    const taxOptimizer = new TaxOptimizationService();

    useEffect(() => {
        calculateTaxData();
    }, [data, selectedYear]);

    const calculateTaxData = async () => {
        setLoading(true);
        try {
            // Generate tax lots from trades
            const taxLots = taxCalculator.generateTaxLots(data.closed_trades.map(trade => ({
                ...trade,
                direction: trade.realized_profit >= 0 ? 'SELL' as any : 'BUY' as any,
                date: trade.date,
                ticker: trade.ticker,
                quantity: trade.quantity,
                price: trade.sell_price,
                fee: trade.sell_fees,
                amount: trade.sale_proceeds,
                currency: trade.currency
            })));

            // Calculate tax for current year
            const currentYear = selectedYear;
            const residency = taxSettings.residencies.find(r => r.country === 'United States') || taxSettings.residencies[0];
            
            const taxCalc = taxCalculator.calculateTaxLiability(
                currentYear,
                residency,
                taxLots,
                data.dividends
            );

            setTaxCalculations({ [currentYear]: taxCalc });

            // Generate optimizations
            const optimizations = taxOptimizer.generateOptimizations(
                { [currentYear]: taxCalc },
                data.open_positions,
                new Map(), // Would be populated with current prices
                { harvestThreshold: taxSettings.harvestThreshold, riskTolerance: 'moderate' }
            );

            setTaxOptimizations(optimizations);

        } catch (error) {
            console.error('Error calculating tax data:', error);
        } finally {
            setLoading(false);
        }
    };

    const currentTaxCalc = taxCalculations[selectedYear];
    const totalPotentialSavings = taxOptimizations.reduce((sum, opt) => sum + opt.potentialSavings, 0);

    // Chart data for tax breakdown
    const taxBreakdownData = currentTaxCalc ? [
        { name: 'Short Term Gains', value: Math.abs(currentTaxCalc.shortTermGains), color: '#ef4444' },
        { name: 'Long Term Gains', value: Math.abs(currentTaxCalc.longTermGains), color: '#10b981' },
        { name: 'Dividend Income', value: Math.abs(currentTaxCalc.dividendIncome), color: '#3b82f6' },
        { name: 'Harvested Losses', value: Math.abs(currentTaxCalc.harvestedLosses), color: '#f59e0b' }
    ].filter(item => item.value > 0) : [];

    // Optimization chart data
    const optimizationData = taxOptimizations.slice(0, 5).map(opt => ({
        name: opt.type,
        savings: opt.potentialSavings,
        description: opt.description.substring(0, 30) + '...'
    }));

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('en-US', { 
            style: 'currency', 
            currency: 'USD', 
            maximumFractionDigits: 0 
        }).format(val);
    };

    return (
        <div className="h-full flex flex-col bg-[#121212] text-white">
            {/* Header */}
            <div className="flex-none p-4 border-b border-gray-800 flex justify-between items-center bg-[#1a1a1a]">
                <h1 className="text-xl font-bold flex items-center gap-2">
                    <Calculator className="text-blue-400" size={24} />
                    Tax Optimization Dashboard
                </h1>
                <div className="flex gap-4 items-center">
                    <button
                        onClick={() => setShowSettings(true)}
                        className="p-2 bg-gray-800 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
                        title="Tax Settings"
                    >
                        <Settings size={18} />
                    </button>
                    <button
                        onClick={calculateTaxData}
                        disabled={loading}
                        className="p-2 bg-gray-800 hover:bg-gray-700 disabled:bg-gray-900 rounded text-gray-400 hover:text-white transition-colors"
                        title="Refresh Tax Data"
                    >
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                        className="bg-gray-800 text-white border border-gray-700 rounded px-3 py-1 outline-none focus:border-blue-500 text-sm"
                    >
                        <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>
                        <option value={new Date().getFullYear() - 1}>{new Date().getFullYear() - 1}</option>
                        <option value={new Date().getFullYear() - 2}>{new Date().getFullYear() - 2}</option>
                    </select>
                </div>
            </div>

            <div className="flex-1 overflow-auto p-4 space-y-4">
                {/* KPI Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <KpiCard
                        title="Estimated Tax"
                        value={currentTaxCalc ? currentTaxCalc.estimatedTax : 0}
                        format={formatCurrency}
                        icon={<DollarSign size={18} />}
                        color="red"
                    />
                    <KpiCard
                        title="Potential Savings"
                        value={totalPotentialSavings}
                        format={formatCurrency}
                        icon={<Target size={18} />}
                        color="green"
                    />
                    <KpiCard
                        title="Tax Efficiency"
                        value={currentTaxCalc ? `${taxCalculator.calculateTaxEfficiencyScore(currentTaxCalc).toFixed(0)}%` : '0%'}
                        icon={<TrendingUp size={18} />}
                        color="blue"
                        isCount
                    />
                    <KpiCard
                        title="Optimizations"
                        value={taxOptimizations.length}
                        icon={<Shield size={18} />}
                        color="purple"
                        isCount
                    />
                </div>

                {/* Charts Row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Tax Breakdown Chart */}
                    <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
                        <h3 className="text-sm font-semibold mb-3 text-gray-400">Tax Breakdown ({selectedYear})</h3>
                        <div className="h-64">
                            {taxBreakdownData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={taxBreakdownData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            {taxBreakdownData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                                            formatter={(val: number | undefined) => [formatCurrency(val || 0), 'Amount']}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="flex items-center justify-center h-full text-gray-500">
                                    No tax data available for {selectedYear}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Optimization Opportunities Chart */}
                    <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
                        <h3 className="text-sm font-semibold mb-3 text-gray-400">Top Optimization Opportunities</h3>
                        <div className="h-64">
                            {optimizationData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={optimizationData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                                        <XAxis dataKey="name" stroke="#666" fontSize={11} />
                                        <YAxis stroke="#666" fontSize={11} tickFormatter={(val) => `$${val}`} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                                            formatter={(val: number | undefined) => [formatCurrency(val || 0), 'Savings']}
                                            labelFormatter={(label) => optimizationData.find(d => d.name === label)?.description || label}
                                        />
                                        <Bar dataKey="savings" fill="#10b981" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="flex items-center justify-center h-full text-gray-500">
                                    No optimization opportunities found
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Tax Optimizations List */}
                {taxOptimizations.length > 0 && (
                    <div className="bg-gray-900 rounded-lg border border-gray-800">
                        <div className="p-4 border-b border-gray-800">
                            <h3 className="text-lg font-semibold flex items-center gap-2">
                                <Target className="text-green-400" size={20} />
                                Tax Optimization Recommendations
                            </h3>
                        </div>
                        <div className="divide-y divide-gray-800">
                            {taxOptimizations.map((opt, index) => (
                                <div key={opt.id} className="p-4 hover:bg-gray-800 transition-colors">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className={`px-2 py-1 text-xs rounded-full ${
                                                    opt.type === 'harvesting' ? 'bg-green-500/20 text-green-400' :
                                                    opt.type === 'deferral' ? 'bg-blue-500/20 text-blue-400' :
                                                    opt.type === 'location' ? 'bg-purple-500/20 text-purple-400' :
                                                    'bg-amber-500/20 text-amber-400'
                                                }`}>
                                                    {opt.type}
                                                </span>
                                                <span className={`px-2 py-1 text-xs rounded-full ${
                                                    opt.implementation.risk === 'low' ? 'bg-green-500/20 text-green-400' :
                                                    opt.implementation.risk === 'medium' ? 'bg-amber-500/20 text-amber-400' :
                                                    'bg-red-500/20 text-red-400'
                                                }`}>
                                                    {opt.implementation.risk} risk
                                                </span>
                                            </div>
                                            <p className="text-gray-300 mb-2">{opt.description}</p>
                                            <div className="flex items-center gap-4 text-sm text-gray-400">
                                                <span>Action: {opt.implementation.action}</span>
                                                <span>Timeline: {opt.implementation.timeline}</span>
                                            </div>
                                        </div>
                                        <div className="text-right ml-4">
                                            <div className="text-green-400 font-semibold">
                                                {formatCurrency(opt.potentialSavings)}
                                            </div>
                                            <div className="text-xs text-gray-500">potential savings</div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Tax Summary */}
                {currentTaxCalc && (
                    <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
                        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                            <Calculator className="text-blue-400" size={20} />
                            Tax Summary ({selectedYear})
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                                <div className="text-gray-400 text-xs uppercase mb-1">Short Term Gains</div>
                                <div className="text-lg font-semibold text-red-400">
                                    {formatCurrency(currentTaxCalc.shortTermGains)}
                                </div>
                            </div>
                            <div>
                                <div className="text-gray-400 text-xs uppercase mb-1">Long Term Gains</div>
                                <div className="text-lg font-semibold text-green-400">
                                    {formatCurrency(currentTaxCalc.longTermGains)}
                                </div>
                            </div>
                            <div>
                                <div className="text-gray-400 text-xs uppercase mb-1">Dividend Income</div>
                                <div className="text-lg font-semibold text-blue-400">
                                    {formatCurrency(currentTaxCalc.dividendIncome)}
                                </div>
                            </div>
                            <div>
                                <div className="text-gray-400 text-xs uppercase mb-1">Effective Rate</div>
                                <div className="text-lg font-semibold text-purple-400">
                                    {currentTaxCalc.effectiveRate.toFixed(1)}%
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// Reusable KPI Card component
const KpiCard: React.FC<{
    title: string;
    value: number | string;
    format?: (v: number) => string;
    icon: React.ReactNode;
    color: string;
    isCount?: boolean;
}> = ({ title, value, format, icon, color, isCount }) => {
    const colorClasses: Record<string, string> = {
        red: 'border-l-red-500 text-red-400 bg-red-500/10',
        green: 'border-l-green-500 text-green-400 bg-green-500/10',
        blue: 'border-l-blue-500 text-blue-400 bg-blue-500/10',
        purple: 'border-l-purple-500 text-purple-400 bg-purple-500/10',
        amber: 'border-l-amber-500 text-amber-400 bg-amber-500/10',
    };

    const c = colorClasses[color] || colorClasses['blue'];

    return (
        <div className={`bg-gray-900 rounded-lg p-3 border-l-4 ${c.split(' ')[0]} border-t border-r border-b border-gray-800`}>
            <div className="flex items-center gap-2 mb-1">
                <div className={`p-1.5 rounded-lg ${c.split(' ').slice(1).join(' ')}`}>
                    {icon}
                </div>
                <span className="text-gray-400 text-xs font-medium uppercase tracking-wider">{title}</span>
            </div>
            <div className="text-xl font-bold text-white">
                {isCount ? value : (typeof value === 'number' && format ? format(value) : value)}
            </div>
        </div>
    );
};