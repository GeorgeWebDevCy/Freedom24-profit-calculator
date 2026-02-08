import React, { useState } from 'react';
import { PriceAlert } from '../../lib/types';
import { Plus, X, Save, Target, TrendingUp, Volume2, Zap } from 'lucide-react';

interface CreateAlertModalProps {
    alert: PriceAlert | null;
    symbols: string[];
    onSave: (alert: Omit<PriceAlert, 'id' | 'createdAt' | 'triggeredAt' | 'notificationSent'>) => void;
    onUpdate: (alertId: string, updates: Partial<PriceAlert>) => void;
    onClose: () => void;
}

export const CreateAlertModal: React.FC<CreateAlertModalProps> = ({ 
    alert, 
    symbols, 
    onSave, 
    onUpdate, 
    onClose 
}) => {
    const [formData, setFormData] = useState({
        symbol: alert?.symbol || '',
        type: alert?.type || 'price_above' as const,
        threshold: alert?.threshold || 0,
        currency: alert?.currency || 'USD',
        isActive: alert?.isActive ?? true,
        condition: {
            operator: alert?.condition.operator || '>' as const,
            value: alert?.condition.value || 0,
            timeframe: alert?.condition.timeframe
        },
        repeatSettings: alert?.repeatSettings
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        if (alert) {
            onUpdate(alert.id, formData);
        } else {
            onSave(formData);
        }
    };

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('en-US', { 
            style: 'currency', 
            currency: 'USD', 
            maximumFractionDigits: 2 
        }).format(val);
    };

    const getAlertTypeIcon = (type: PriceAlert['type']) => {
        switch (type) {
            case 'price_above': return <TrendingUp className="text-green-400" size={20} />;
            case 'price_below': return <TrendingUp className="text-red-400 rotate-180" size={20} />;
            case 'percentage_change': return <Target className="text-blue-400" size={20} />;
            case 'volume_spike': return <Volume2 className="text-purple-400" size={20} />;
            case 'portfolio_value': return <Zap className="text-amber-400" size={20} />;
            default: return <Target className="text-gray-400" size={20} />;
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
            <div className="bg-[#1a1a1a] border border-gray-700 rounded-lg max-w-md w-full shadow-2xl">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-gray-700">
                    <h2 className="text-xl font-bold">
                        {alert ? 'Edit Alert' : 'Create New Alert'}
                    </h2>
                    <button onClick={onClose} className="text-gray-300 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400/60 rounded">
                        <X size={24} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Symbol Selection */}
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">
                            Symbol
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                value={formData.symbol}
                                onChange={(e) => setFormData(prev => ({ ...prev, symbol: e.target.value.toUpperCase() }))}
                                placeholder="e.g., AAPL, GOOGL, TSLA"
                                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none text-lg"
                                required
                            />
                            {formData.symbol && (
                                <div className="absolute right-3 top-3.5">
                                    {getAlertTypeIcon(formData.type)}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Alert Type */}
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">
                            Alert Type
                        </label>
                        <select
                            value={formData.type}
                            onChange={(e) => setFormData(prev => ({ 
                                ...prev, 
                                type: e.target.value as PriceAlert['type']
                            }))}
                            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:border-blue-500 outline-none"
                        >
                            <option value="price_above">Price Above Threshold</option>
                            <option value="price_below">Price Below Threshold</option>
                            <option value="percentage_change">Percentage Change</option>
                            <option value="volume_spike">Volume Spike</option>
                            <option value="portfolio_value">Portfolio Value Change</option>
                        </select>
                    </div>

                    {/* Threshold */}
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">
                            {formData.type === 'percentage_change' ? 'Percentage Change (%)' :
                             formData.type === 'volume_spike' ? 'Volume Increase (%)' :
                             'Price Threshold ($)'}
                        </label>
                        <input
                            type="number"
                            value={formData.threshold}
                            onChange={(e) => setFormData(prev => ({ ...prev, threshold: parseFloat(e.target.value) }))}
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-blue-500 outline-none"
                            required
                        />
                        {formData.type !== 'percentage_change' && formData.type !== 'volume_spike' && formData.threshold > 0 && (
                            <div className="text-sm text-gray-500 mt-1">
                                Alert will trigger at {formatCurrency(formData.threshold)}
                            </div>
                        )}
                    </div>

                    {/* Condition Settings */}
                    {(formData.type === 'percentage_change' || formData.type === 'volume_spike') && (
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-2">
                                Condition
                            </label>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">Operator</label>
                                    <select
                                        value={formData.condition.operator}
                                        onChange={(e) => setFormData(prev => ({ 
                                            ...prev, 
                                            condition: { ...prev.condition, operator: e.target.value as any }
                                        }))}
                                        className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
                                    >
                                        <option value=">">Greater than</option>
                                        <option value="<">Less than</option>
                                        <option value=">=">Greater than or equal</option>
                                        <option value="<=">Less than or equal</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">Timeframe (hours)</label>
                                    <input
                                        type="number"
                                        value={formData.condition.timeframe || ''}
                                        onChange={(e) => setFormData(prev => ({ 
                                            ...prev, 
                                            condition: { ...prev.condition, timeframe: parseInt(e.target.value) || undefined }
                                        }))}
                                        placeholder="Optional"
                                        min="1"
                                        max="8760"
                                        className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Repeat Settings */}
                    <div>
                        <label className="flex items-center gap-2 text-sm text-gray-400 mb-2">
                            <input
                                type="checkbox"
                                checked={formData.repeatSettings?.enabled || false}
                                onChange={(e) => setFormData(prev => ({ 
                                    ...prev, 
                                    repeatSettings: { 
                                        ...prev.repeatSettings, 
                                        enabled: e.target.checked,
                                        frequency: prev.repeatSettings?.frequency || 'once',
                                        maxTriggers: prev.repeatSettings?.maxTriggers
                                    }
                                }))}
                                className="w-4 h-4"
                            />
                            Enable repeat alerts
                        </label>
                        {formData.repeatSettings?.enabled && (
                            <div className="grid grid-cols-2 gap-4 ml-6">
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">Frequency</label>
                                    <select
                                        value={formData.repeatSettings?.frequency || 'once'}
                                        onChange={(e) => setFormData(prev => ({ 
                                            ...prev, 
                                            repeatSettings: { 
                                                ...prev.repeatSettings!, 
                                                frequency: e.target.value as any
                                            }
                                        }))}
                                        className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
                                    >
                                        <option value="once">Once</option>
                                        <option value="daily">Daily</option>
                                        <option value="weekly">Weekly</option>
                                        <option value="until_canceled">Until canceled</option>
                                    </select>
                                </div>
                                {formData.repeatSettings.frequency !== 'once' && (
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">Max triggers</label>
                                        <input
                                            type="number"
                                            value={formData.repeatSettings?.maxTriggers || ''}
                                            onChange={(e) => setFormData(prev => ({ 
                                                ...prev, 
                                                repeatSettings: { 
                                                    ...prev.repeatSettings!, 
                                                    maxTriggers: parseInt(e.target.value) || undefined
                                                }
                                            }))}
                                            placeholder="No limit"
                                            min="1"
                                            max="100"
                                            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Active Status */}
                    <div>
                        <label className="flex items-center gap-2 text-sm text-gray-400">
                            <input
                                type="checkbox"
                                checked={formData.isActive}
                                onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                                className="w-4 h-4"
                            />
                            Enable alert immediately
                        </label>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-700">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-2 bg-gray-800 hover:bg-gray-700 text-gray-100 border border-gray-700 rounded-lg font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400/60"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium flex items-center gap-2"
                        >
                            <Save size={18} />
                            {alert ? 'Update Alert' : 'Create Alert'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
