import React from 'react';
import { AlertTemplate } from '../../lib/types';
import { Plus, X, Target, TrendingUp, Zap } from 'lucide-react';

interface AlertTemplatesModalProps {
    templates: AlertTemplate[];
    onSelect: (template: AlertTemplate) => void;
    onClose: () => void;
}

export const AlertTemplatesModal: React.FC<AlertTemplatesModalProps> = ({ 
    templates, 
    onSelect, 
    onClose 
}) => {
    const getTemplateIcon = (category: AlertTemplate['category']) => {
        switch (category) {
            case 'price': return <Target className="text-blue-400" size={20} />;
            case 'volume': return <TrendingUp className="text-purple-400" size={20} />;
            case 'portfolio': return <Zap className="text-amber-400" size={20} />;
            default: return <Target className="text-gray-400" size={20} />;
        }
    };

    const popularTemplates = templates.filter(t => t.popular);
    const customTemplates = templates.filter(t => !t.popular);

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('en-US', { 
            style: 'currency', 
            currency: 'USD', 
            maximumFractionDigits: 2 
        }).format(val);
    };

    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
            <div className="bg-[#1a1a1a] border border-gray-700 rounded-lg max-w-2xl w-full max-h-[80vh] shadow-2xl flex flex-col">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-gray-700">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <Target className="text-blue-400" size={24} />
                        Alert Templates
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-6">
                    {/* Popular Templates */}
                    {popularTemplates.length > 0 && (
                        <div className="mb-8">
                            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                <Target className="text-amber-400" size={20} />
                                Popular Templates
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {popularTemplates.map(template => (
                                    <div
                                        key={template.id}
                                        onClick={() => onSelect(template)}
                                        className="bg-gray-900 rounded-lg p-4 border border-gray-800 hover:border-blue-500 hover:bg-gray-800 cursor-pointer transition-all"
                                    >
                                        <div className="flex items-start gap-3 mb-3">
                                            {getTemplateIcon(template.category)}
                                            <div className="flex-1">
                                                <h4 className="font-semibold text-white mb-1">{template.name}</h4>
                                                <p className="text-sm text-gray-400">{template.description}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between text-xs text-gray-500">
                                            <span className="px-2 py-1 bg-amber-500/20 text-amber-400 rounded">
                                                Popular
                                            </span>
                                            <div className="text-right">
                                                {template.template.type === 'price_above' && `> ${formatCurrency(template.template.threshold)}`}
                                                {template.template.type === 'price_below' && `< ${formatCurrency(template.template.threshold)}`}
                                                {template.template.type === 'percentage_change' && `±${template.template.threshold}%`}
                                                {template.template.type === 'portfolio_value' && `±${template.template.threshold}%`}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Custom Templates */}
                    <div>
                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            <Plus className="text-blue-400" size={20} />
                            Custom Templates
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {customTemplates.map(template => (
                                <div
                                    key={template.id}
                                    onClick={() => onSelect(template)}
                                    className="bg-gray-900 rounded-lg p-4 border border-gray-800 hover:border-blue-500 hover:bg-gray-800 cursor-pointer transition-all"
                                >
                                    <div className="flex items-start gap-3 mb-3">
                                        {getTemplateIcon(template.category)}
                                        <div className="flex-1">
                                            <h4 className="font-semibold text-white mb-1">{template.name}</h4>
                                            <p className="text-sm text-gray-400">{template.description}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between text-xs text-gray-500">
                                        <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded">
                                            {template.category}
                                        </span>
                                        <div className="text-right">
                                            {template.template.type === 'price_above' && `> ${formatCurrency(template.template.threshold)}`}
                                            {template.template.type === 'price_below' && `< ${formatCurrency(template.template.threshold)}`}
                                            {template.template.type === 'percentage_change' && `±${template.template.threshold}%`}
                                            {template.template.type === 'portfolio_value' && `±${template.template.threshold}%`}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex justify-end p-6 border-t border-gray-700">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg font-medium"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};