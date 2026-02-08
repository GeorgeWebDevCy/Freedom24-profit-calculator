import React, { useState } from 'react';
import { TaxSettings as TaxSettingsType, TaxResidency } from '../../lib/types';
import { TaxCalculatorService } from '../../lib/services/tax-calculator.service';
import { X, Save, Plus, Trash2, Globe, DollarSign, Shield, Target } from 'lucide-react';

interface TaxSettingsProps {
    settings: TaxSettingsType;
    onSettingsChange: (settings: TaxSettingsType) => void;
    onClose: () => void;
}

export const TaxSettingsComponent: React.FC<TaxSettingsProps> = ({ settings, onSettingsChange, onClose }) => {
    const [localSettings, setLocalSettings] = useState<TaxSettingsType>(settings);
    const [activeTab, setActiveTab] = useState<'residency' | 'optimization' | 'general'>('residency');

    const handleSave = () => {
        onSettingsChange(localSettings);
        onClose();
    };

    const addResidency = () => {
        const newResidency: TaxResidency = {
            country: 'Cyprus (Non-Dom)',
            taxYear: new Date().getFullYear(),
            taxRate: {
                shortTerm: 0,
                longTerm: 0,
                dividend: 0,
                capitalGains: 0
            }
        };

        setLocalSettings(prev => ({
            ...prev,
            residencies: [...prev.residencies, newResidency]
        }));
    };

    const removeResidency = (index: number) => {
        setLocalSettings(prev => ({
            ...prev,
            residencies: prev.residencies.filter((_, i) => i !== index)
        }));
    };

    const updateResidency = (index: number, field: keyof TaxResidency, value: any) => {
        setLocalSettings(prev => ({
            ...prev,
            residencies: prev.residencies.map((res, i) => 
                i === index ? { ...res, [field]: value } : res
            )
        }));
    };

    const updateTaxRate = (residencyIndex: number, rateField: string, value: number) => {
        setLocalSettings(prev => ({
            ...prev,
            residencies: prev.residencies.map((res, i) => 
                i === residencyIndex 
                    ? { 
                        ...res, 
                        taxRate: { 
                            ...res.taxRate, 
                            [rateField]: value 
                        } 
                    } 
                    : res
            )
        }));
    };

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('en-US', { 
            style: 'currency', 
            currency: localSettings.defaultCurrency, 
            maximumFractionDigits: 2 
        }).format(val);
    };

    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
            <div className="bg-[#1a1a1a] border border-gray-700 rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-gray-700">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <Globe className="text-blue-400" size={24} />
                        Tax Settings
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">
                        <X size={24} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-700">
                    <button
                        onClick={() => setActiveTab('residency')}
                        className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${
                            activeTab === 'residency' 
                                ? 'border-blue-500 text-white bg-gray-800/50' 
                                : 'border-transparent text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                    >
                        <Globe size={16} className="inline mr-2" />
                        Tax Residency
                    </button>
                    <button
                        onClick={() => setActiveTab('optimization')}
                        className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${
                            activeTab === 'optimization' 
                                ? 'border-blue-500 text-white bg-gray-800/50' 
                                : 'border-transparent text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                    >
                        <Target size={16} className="inline mr-2" />
                        Optimization
                    </button>
                    <button
                        onClick={() => setActiveTab('general')}
                        className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${
                            activeTab === 'general' 
                                ? 'border-blue-500 text-white bg-gray-800/50' 
                                : 'border-transparent text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                    >
                        <DollarSign size={16} className="inline mr-2" />
                        General
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-6">
                    {activeTab === 'residency' && (
                        <div className="space-y-6">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-semibold">Tax Residencies</h3>
                                <button
                                    onClick={addResidency}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-medium flex items-center gap-2"
                                >
                                    <Plus size={16} /> Add Residency
                                </button>
                            </div>

                            {localSettings.residencies.map((residency, index) => (
                                <div key={index} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex-1 grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-400 mb-1">
                                                    Country
                                                </label>
                                                <input
                                                    type="text"
                                                    value={residency.country}
                                                    onChange={(e) => updateResidency(index, 'country', e.target.value)}
                                                    className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white outline-none focus:border-blue-500"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-400 mb-1">
                                                    Tax Year
                                                </label>
                                                <input
                                                    type="number"
                                                    value={residency.taxYear}
                                                    onChange={(e) => updateResidency(index, 'taxYear', parseInt(e.target.value))}
                                                    className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white outline-none focus:border-blue-500"
                                                />
                                            </div>
                                        </div>
                                        {localSettings.residencies.length > 1 && (
                                            <button
                                                onClick={() => removeResidency(index)}
                                                className="ml-4 text-red-400 hover:text-red-300"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-400 mb-1">
                                                Short Term Rate (%)
                                            </label>
                                            <input
                                                type="number"
                                                value={residency.taxRate.shortTerm}
                                                onChange={(e) => updateTaxRate(index, 'shortTerm', parseFloat(e.target.value))}
                                                step="0.1"
                                                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white outline-none focus:border-blue-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-400 mb-1">
                                                Long Term Rate (%)
                                            </label>
                                            <input
                                                type="number"
                                                value={residency.taxRate.longTerm}
                                                onChange={(e) => updateTaxRate(index, 'longTerm', parseFloat(e.target.value))}
                                                step="0.1"
                                                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white outline-none focus:border-blue-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-400 mb-1">
                                                Dividend Rate (%)
                                            </label>
                                            <input
                                                type="number"
                                                value={residency.taxRate.dividend}
                                                onChange={(e) => updateTaxRate(index, 'dividend', parseFloat(e.target.value))}
                                                step="0.1"
                                                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white outline-none focus:border-blue-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-400 mb-1">
                                                Capital Gains Rate (%)
                                            </label>
                                            <input
                                                type="number"
                                                value={residency.taxRate.capitalGains || ''}
                                                onChange={(e) => updateTaxRate(index, 'capitalGains', parseFloat(e.target.value))}
                                                step="0.1"
                                                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white outline-none focus:border-blue-500"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {activeTab === 'optimization' && (
                        <div className="space-y-6">
                            <h3 className="text-lg font-semibold mb-4">Optimization Settings</h3>
                            
                            <div className="space-y-4">
                                <div className="flex items-center justify-between bg-gray-800 p-4 rounded-lg">
                                    <div>
                                        <h4 className="font-medium mb-1">Enable Tax Optimization</h4>
                                        <p className="text-sm text-gray-400">Show tax optimization recommendations</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={localSettings.optimizationEnabled}
                                            onChange={(e) => setLocalSettings(prev => ({ 
                                                ...prev, 
                                                optimizationEnabled: e.target.checked 
                                            }))}
                                            className="sr-only peer"
                                        />
                                        <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                    </label>
                                </div>

                                <div className="bg-gray-800 p-4 rounded-lg">
                                    <label className="block text-sm font-medium text-gray-400 mb-2">
                                        Harvest Threshold ({formatCurrency(localSettings.harvestThreshold)})
                                    </label>
                                    <input
                                        type="range"
                                        min="100"
                                        max="10000"
                                        step="100"
                                        value={localSettings.harvestThreshold}
                                        onChange={(e) => setLocalSettings(prev => ({ 
                                            ...prev, 
                                            harvestThreshold: parseInt(e.target.value) 
                                        }))}
                                        className="w-full"
                                    />
                                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                                        <span>$100</span>
                                        <span>$10,000</span>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between bg-gray-800 p-4 rounded-lg">
                                    <div>
                                        <h4 className="font-medium mb-1">Wash Sale Detection</h4>
                                        <p className="text-sm text-gray-400">Detect and warn about wash sale violations</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={localSettings.washSaleEnabled}
                                            onChange={(e) => setLocalSettings(prev => ({ 
                                                ...prev, 
                                                washSaleEnabled: e.target.checked 
                                            }))}
                                            className="sr-only peer"
                                        />
                                        <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                    </label>
                                </div>

                                <div className="flex items-center justify-between bg-gray-800 p-4 rounded-lg">
                                    <div>
                                        <h4 className="font-medium mb-1">Tax Loss Carryforward</h4>
                                        <p className="text-sm text-gray-400">Track and utilize tax loss carryforwards</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={localSettings.taxLossCarryforwardEnabled}
                                            onChange={(e) => setLocalSettings(prev => ({ 
                                                ...prev, 
                                                taxLossCarryforwardEnabled: e.target.checked 
                                            }))}
                                            className="sr-only peer"
                                        />
                                        <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'general' && (
                        <div className="space-y-6">
                            <h3 className="text-lg font-semibold mb-4">General Settings</h3>
                            
                            <div className="space-y-4">
                                <div className="bg-gray-800 p-4 rounded-lg">
                                    <label className="block text-sm font-medium text-gray-400 mb-2">
                                        Default Currency
                                    </label>
                                    <select
                                        value={localSettings.defaultCurrency}
                                        onChange={(e) => setLocalSettings(prev => ({ 
                                            ...prev, 
                                            defaultCurrency: e.target.value 
                                        }))}
                                        className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white outline-none focus:border-blue-500"
                                    >
                                        <option value="USD">USD - US Dollar</option>
                                        <option value="EUR">EUR - Euro</option>
                                        <option value="GBP">GBP - British Pound</option>
                                        <option value="CHF">CHF - Swiss Franc</option>
                                        <option value="JPY">JPY - Japanese Yen</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex justify-end p-6 border-t border-gray-700">
                    <button
                        onClick={handleSave}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-medium flex items-center gap-2"
                    >
                        <Save size={18} /> Save Settings
                    </button>
                </div>
            </div>
        </div>
    );
};

export const TaxSettings = TaxSettingsComponent;
