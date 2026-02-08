import React, { useState, useEffect } from 'react';
import { PriceAlert, AlertSettings, AlertNotification, AlertHistory, AlertTemplate } from '../../lib/types';
import { AlertsService } from '../../lib/services/alerts.service';
import { 
    Bell, 
    Plus, 
    Edit2, 
    Trash2, 
    Settings, 
    TrendingUp, 
    Volume2, 
    Target, 
    Clock, 
    Check,
    X,
    AlertTriangle,
    Eye,
    EyeOff,
    RefreshCw,
    ChevronDown,
    Zap
} from 'lucide-react';
import { CreateAlertModal } from './CreateAlertModal';
import { AlertTemplatesModal } from './AlertTemplatesModal';

interface AlertManagerProps {
    symbols: string[];
    onAlertsChange?: (alerts: PriceAlert[]) => void;
}

export const AlertManager: React.FC<AlertManagerProps> = ({ symbols, onAlertsChange }) => {
    const [alerts, setAlerts] = useState<PriceAlert[]>([]);
    const [notifications, setNotifications] = useState<AlertNotification[]>([]);
    const [history, setHistory] = useState<AlertHistory[]>([]);
    const [showCreateAlert, setShowCreateAlert] = useState(false);
    const [editingAlert, setEditingAlert] = useState<PriceAlert | null>(null);
    const [activeTab, setActiveTab] = useState<'active' | 'history' | 'settings'>('active');
    const [showTemplates, setShowTemplates] = useState(false);
    const [alertService, setAlertService] = useState<AlertsService | null>(null);

    useEffect(() => {
        const settings = AlertsService.getDefaultSettings();
        const service = new AlertsService(settings);
        setAlertService(service);
        
        // Load existing data
        setAlerts(service.getAlerts());
        setNotifications(service.getNotifications());
        setHistory(service.getAlertHistory());
        
        // Start monitoring for provided symbols
        if (symbols.length > 0) {
            service.startMonitoring(symbols);
        }

        return () => {
            service.stopMonitoring();
        };
    }, [symbols]);

    const createAlert = (alertData: Omit<PriceAlert, 'id' | 'createdAt' | 'triggeredAt' | 'notificationSent'>) => {
        if (!alertService) return;
        
        const newAlert = alertService.createAlert(alertData);
        setAlerts(prev => [...prev, newAlert]);
        onAlertsChange?.([...alerts, newAlert]);
        setShowCreateAlert(false);
    };

    const updateAlert = (alertId: string, updates: Partial<PriceAlert>) => {
        if (!alertService) return;
        
        alertService.updateAlert(alertId, updates);
        setAlerts(prev => prev.map(alert => 
            alert.id === alertId ? { ...alert, ...updates } : alert
        ));
        setEditingAlert(null);
    };

    const deleteAlert = (alertId: string) => {
        if (!alertService) return;
        
        alertService.deleteAlert(alertId);
        setAlerts(prev => prev.filter(alert => alert.id !== alertId));
    };

    const markNotificationRead = (notificationId: string) => {
        if (!alertService) return;
        
        alertService.markNotificationRead(notificationId);
        setNotifications(prev => prev.map(notif => 
            notif.id === notificationId ? { ...notif, read: true } : notif
        ));
    };

    const toggleAlert = (alertId: string) => {
        const alert = alerts.find(a => a.id === alertId);
        if (alert) {
            updateAlert(alertId, { isActive: !alert.isActive });
        }
    };

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('en-US', { 
            style: 'currency', 
            currency: 'USD', 
            maximumFractionDigits: 2 
        }).format(val);
    };

    const getAlertIcon = (type: PriceAlert['type']) => {
        switch (type) {
            case 'price_above': return <TrendingUp className="text-green-400" size={16} />;
            case 'price_below': return <TrendingUp className="text-red-400 rotate-180" size={16} />;
            case 'percentage_change': return <Target className="text-blue-400" size={16} />;
            case 'volume_spike': return <Volume2 className="text-purple-400" size={16} />;
            case 'portfolio_value': return <Zap className="text-amber-400" size={16} />;
            default: return <Bell className="text-gray-400" size={16} />;
        }
    };

    const activeAlerts = alerts.filter(alert => alert.isActive);
    const unreadNotifications = notifications.filter(notif => !notif.read);

    return (
        <div className="h-full flex flex-col bg-[#121212] text-white">
            {/* Header */}
            <div className="flex-none p-4 border-b border-gray-800 flex justify-between items-center bg-[#1a1a1a]">
                <h1 className="text-xl font-bold flex items-center gap-2">
                    <Bell className="text-blue-400" size={24} />
                    Price Alerts
                    {unreadNotifications.length > 0 && (
                        <span className="bg-red-500 text-white text-xs rounded-full px-2 py-1">
                            {unreadNotifications.length}
                        </span>
                    )}
                </h1>
                <div className="flex gap-2 items-center">
                    <button
                        onClick={() => setShowTemplates(true)}
                        className="p-2 bg-gray-800 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
                        title="Alert Templates"
                    >
                        <Target size={18} />
                    </button>
                    <button
                        onClick={() => setActiveTab('settings')}
                        className="p-2 bg-gray-800 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
                        title="Settings"
                    >
                        <Settings size={18} />
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-800">
                <button
                    onClick={() => setActiveTab('active')}
                    className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                        activeTab === 'active' 
                            ? 'border-blue-500 text-white bg-gray-800/50' 
                            : 'border-transparent text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                >
                    Active Alerts ({activeAlerts.length})
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                        activeTab === 'history' 
                            ? 'border-blue-500 text-white bg-gray-800/50' 
                            : 'border-transparent text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                >
                    History ({notifications.length})
                </button>
                <button
                    onClick={() => setActiveTab('settings')}
                    className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                        activeTab === 'settings' 
                            ? 'border-blue-500 text-white bg-gray-800/50' 
                            : 'border-transparent text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                >
                    Settings
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto">
                {activeTab === 'active' && (
                    <div className="p-4">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-semibold">Active Alerts</h2>
                            <button
                                onClick={() => setShowCreateAlert(true)}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-medium flex items-center gap-2"
                            >
                                <Plus size={16} /> Create Alert
                            </button>
                        </div>

                        {activeAlerts.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                                <Bell size={48} className="mx-auto mb-4 opacity-50" />
                                <p className="text-lg mb-2">No active alerts</p>
                                <p className="text-sm">Create an alert to get notified when your stocks reach specific price levels.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {activeAlerts.map(alert => (
                                    <div key={alert.id} className="bg-gray-900 rounded-lg p-4 border border-gray-800">
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3 mb-2">
                                                    {getAlertIcon(alert.type)}
                                                    <h3 className="font-semibold text-lg">{alert.symbol}</h3>
                                                    <span className={`px-2 py-1 text-xs rounded-full ${
                                                        alert.isActive ? 'bg-green-500/20 text-green-400' : 'bg-gray-600/20 text-gray-400'
                                                    }`}>
                                                        {alert.isActive ? 'Active' : 'Paused'}
                                                    </span>
                                                </div>
                                                <p className="text-gray-300 mb-2">
                                                    {alert.type === 'price_above' && `Alert when price goes above ${formatCurrency(alert.threshold)}`}
                                                    {alert.type === 'price_below' && `Alert when price goes below ${formatCurrency(alert.threshold)}`}
                                                    {alert.type === 'percentage_change' && `Alert when price changes by ${alert.threshold}%`}
                                                    {alert.type === 'volume_spike' && `Alert when volume spikes by ${alert.threshold}%`}
                                                    {alert.type === 'portfolio_value' && `Alert when portfolio value changes by ${alert.threshold}%`}
                                                </p>
                                                {alert.currentValue && (
                                                    <div className="text-sm text-gray-400">
                                                        Current: {formatCurrency(alert.currentValue)}
                                                    </div>
                                                )}
                                                <div className="text-xs text-gray-500">
                                                    Created: {alert.createdAt.toLocaleDateString()}
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => setEditingAlert(alert)}
                                                    className="p-2 bg-gray-800 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
                                                    title="Edit Alert"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                <button
                                                    onClick={() => toggleAlert(alert.id)}
                                                    className="p-2 bg-gray-800 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
                                                    title={alert.isActive ? 'Pause Alert' : 'Resume Alert'}
                                                >
                                                    {alert.isActive ? <EyeOff size={16} /> : <Eye size={16} />}
                                                </button>
                                                <button
                                                    onClick={() => deleteAlert(alert.id)}
                                                    className="p-2 bg-red-600/20 hover:bg-red-600/30 rounded text-red-400 hover:text-red-300"
                                                    title="Delete Alert"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'history' && (
                    <div className="p-4">
                        <h2 className="text-lg font-semibold mb-4">Alert History</h2>
                        {notifications.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                                <Clock size={48} className="mx-auto mb-4 opacity-50" />
                                <p className="text-lg mb-2">No alert history</p>
                                <p className="text-sm">Alert notifications will appear here when they are triggered.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {notifications.map(notification => (
                                    <div 
                                        key={notification.id} 
                                        className={`bg-gray-900 rounded-lg p-4 border border-gray-800 ${
                                            notification.read ? 'opacity-60' : ''
                                        }`}
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <div className={`p-1 rounded ${
                                                        notification.type === 'success' ? 'bg-green-500/20' :
                                                        notification.type === 'warning' ? 'bg-amber-500/20' :
                                                        notification.type === 'error' ? 'bg-red-500/20' :
                                                        'bg-blue-500/20'
                                                    }`}>
                                                        {
                                                            notification.type === 'success' ? <Check className="text-green-400" size={14} /> :
                                                            notification.type === 'warning' ? <AlertTriangle className="text-amber-400" size={14} /> :
                                                            notification.type === 'error' ? <X className="text-red-400" size={14} /> :
                                                            <Bell className="text-blue-400" size={14} />
                                                        }
                                                    </div>
                                                    <h3 className="font-semibold">{notification.title}</h3>
                                                    <span className="text-xs text-gray-500">
                                                        {notification.timestamp.toLocaleString()}
                                                    </span>
                                                    {!notification.read && (
                                                        <button
                                                            onClick={() => markNotificationRead(notification.id)}
                                                            className="text-blue-400 hover:text-blue-300 text-sm ml-2"
                                                        >
                                                            Mark as read
                                                        </button>
                                                    )}
                                                </div>
                                                <p className="text-gray-300">{notification.message}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'settings' && <AlertSettingsPanel />}
            </div>

            {/* Create/Edit Alert Modal */}
            {(showCreateAlert || editingAlert) && (
                <CreateAlertModal
                    alert={editingAlert}
                    symbols={symbols}
                    onSave={createAlert}
                    onUpdate={updateAlert}
                    onClose={() => {
                        setShowCreateAlert(false);
                        setEditingAlert(null);
                    }}
                />
            )}

            {/* Templates Modal */}
            {showTemplates && (
                <AlertTemplatesModal
                    templates={AlertsService.getAlertTemplates()}
                    onSelect={(template: AlertTemplate) => {
                        setShowCreateAlert(true);
                        setShowTemplates(false);
                    }}
                    onClose={() => setShowTemplates(false)}
                />
            )}
        </div>
    );
};

// Alert Settings Panel Component
const AlertSettingsPanel: React.FC = () => {
    const [settings, setSettings] = useState(AlertsService.getDefaultSettings());
    const [alertService] = useState<AlertsService | null>(null);

    useEffect(() => {
        if (alertService) {
            alertService.updateSettings(settings);
        }
    }, [settings, alertService]);

    const updateSetting = (key: string, value: any) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    return (
        <div className="p-4 space-y-6">
            <h2 className="text-lg font-semibold mb-4">Alert Settings</h2>
            
            <div className="space-y-4">
                <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
                    <h3 className="font-medium mb-3">Notification Channels</h3>
                    <div className="space-y-3">
                        <label className="flex items-center justify-between">
                            <span>In-App Notifications</span>
                            <input
                                type="checkbox"
                                checked={settings.notificationChannels.in_app}
                                onChange={(e) => updateSetting('notificationChannels.in_app', e.target.checked)}
                                className="w-4 h-4"
                            />
                        </label>
                        <label className="flex items-center justify-between">
                            <span>Email Notifications</span>
                            <input
                                type="checkbox"
                                checked={settings.notificationChannels.email}
                                onChange={(e) => updateSetting('notificationChannels.email', e.target.checked)}
                                className="w-4 h-4"
                            />
                        </label>
                        <label className="flex items-center justify-between">
                            <span>Push Notifications</span>
                            <input
                                type="checkbox"
                                checked={settings.notificationChannels.push}
                                onChange={(e) => updateSetting('notificationChannels.push', e.target.checked)}
                                className="w-4 h-4"
                            />
                        </label>
                    </div>
                </div>

                <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
                    <h3 className="font-medium mb-3">Quiet Hours</h3>
                    <div className="space-y-3">
                        <label className="flex items-center justify-between">
                            <span>Enable Quiet Hours</span>
                            <input
                                type="checkbox"
                                checked={settings.quietHours.enabled}
                                onChange={(e) => updateSetting('quietHours.enabled', e.target.checked)}
                                className="w-4 h-4"
                            />
                        </label>
                        {settings.quietHours.enabled && (
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Start Time</label>
                                    <input
                                        type="time"
                                        value={settings.quietHours.start}
                                        onChange={(e) => updateSetting('quietHours.start', e.target.value)}
                                        className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">End Time</label>
                                    <input
                                        type="time"
                                        value={settings.quietHours.end}
                                        onChange={(e) => updateSetting('quietHours.end', e.target.value)}
                                        className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
                    <h3 className="font-medium mb-3">Alert Limits</h3>
                    <div className="space-y-3">
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">Cooldown Period (minutes)</label>
                            <input
                                type="number"
                                value={settings.cooldownPeriod}
                                onChange={(e) => updateSetting('cooldownPeriod', parseInt(e.target.value))}
                                min="1"
                                max="60"
                                className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white w-full"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">Max Alerts Per Day</label>
                            <input
                                type="number"
                                value={settings.maxAlertsPerDay}
                                onChange={(e) => updateSetting('maxAlertsPerDay', parseInt(e.target.value))}
                                min="1"
                                max="100"
                                className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white w-full"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};