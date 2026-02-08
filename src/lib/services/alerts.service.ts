/**
 * Price Alerts Service
 * Real-time price monitoring and intelligent alert system
 */

import { 
    PriceAlert, 
    AlertNotification, 
    AlertSettings, 
    AlertHistory, 
    MarketCondition,
    AlertTemplate
} from '../types';
import { fetchStockPrices } from '../price-service';
import type { StockPrice } from '../price-service';

export class AlertsService {
    private alerts: Map<string, PriceAlert> = new Map();
    private notificationQueue: AlertNotification[] = [];
    private alertHistory: AlertHistory[] = [];
    private settings: AlertSettings;
    private monitoringInterval: NodeJS.Timeout | null = null;
    private lastPriceUpdate: Map<string, number> = new Map();
    private priceHistory: Map<string, number[]> = new Map();
    private lastCheckTime = 0;

    constructor(settings: AlertSettings) {
        this.settings = settings;
        this.loadAlertsFromStorage();
        this.loadHistoryFromStorage();
    }

    /**
     * Start real-time monitoring
     */
    startMonitoring(symbols: string[]): void {
        this.stopMonitoring(); // Clear any existing interval

        // Initial fetch
        this.checkPrices(symbols);

        // Set up periodic checking (every 30 seconds for real-time, every 5 minutes for production)
        const intervalMs = process.env.NODE_ENV === 'development' ? 30000 : 300000;
        
        this.monitoringInterval = setInterval(() => {
            this.checkPrices(symbols);
        }, intervalMs);
    }

    /**
     * Stop monitoring
     */
    stopMonitoring(): void {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
    }

    /**
     * Check current prices and trigger alerts
     */
    private async checkPrices(symbols: string[]): Promise<void> {
        try {
            const prices = await fetchStockPrices(symbols);
            const now = Date.now();

            // Update price history
            prices.forEach((price, symbol) => {
                if (!this.priceHistory.has(symbol)) {
                    this.priceHistory.set(symbol, []);
                }
                
                const history = this.priceHistory.get(symbol)!;
                history.push(price.price);
                
                // Keep only last 100 data points
                if (history.length > 100) {
                    history.shift();
                }
            });

            // Check each alert
            this.alerts.forEach((alert, alertId) => {
                if (!alert.isActive) return;

                const symbol = alert.symbol;
                const price = prices.get(symbol);
                
                if (price) {
                    const shouldTrigger = this.evaluateAlert(alert, price.price);
                    
                    if (shouldTrigger) {
                        this.triggerAlert(alert, price.price);
                    }

                    // Update current value
                    alert.currentValue = price.price;
                }
            });

            // Detect market conditions
            const marketConditions = this.detectMarketConditions(prices, symbols);
            this.processMarketConditions(marketConditions);

            this.lastCheckTime = now;
            this.saveAlertsToStorage();

        } catch (error) {
            console.error('Error checking prices for alerts:', error);
        }
    }

    /**
     * Evaluate if alert should trigger
     */
    private evaluateAlert(alert: PriceAlert, currentPrice: number): boolean {
        const { condition } = alert;
        
        // Check cooldown period
        if (alert.triggeredAt) {
            const timeSinceTrigger = Date.now() - alert.triggeredAt.getTime();
            if (timeSinceTrigger < this.settings.cooldownPeriod * 60 * 1000) {
                return false;
            }
        }

        // Check repeat settings
        if (alert.repeatSettings && alert.triggeredAt && alert.repeatSettings.frequency === 'once') {
            return false;
        }

        const threshold = condition.value;
        const previousValue = alert.currentValue || alert.threshold;

        switch (condition.operator) {
            case '>':
                return currentPrice > threshold;
            case '<':
                return currentPrice < threshold;
            case '>=':
                return currentPrice >= threshold;
            case '<=':
                return currentPrice <= threshold;
            case 'percentage':
                const percentageChange = ((currentPrice - previousValue) / previousValue) * 100;
                return Math.abs(percentageChange) >= threshold.value;
            case 'dollar_change':
                const dollarChange = Math.abs(currentPrice - previousValue);
                return dollarChange >= threshold.value;
            default:
                return false;
        }
    }

    /**
     * Trigger alert and send notifications
     */
    private triggerAlert(alert: PriceAlert, currentPrice: number): void {
        const now = new Date();
        
        // Update alert
        alert.triggeredAt = now;
        alert.notificationSent = false;

        // Create notification
        const change = currentPrice - (alert.currentValue || alert.threshold.value);
        const percentageChange = alert.currentValue ? (change / alert.currentValue) * 100 : 0;

        const notification: AlertNotification = {
            id: `notif_${Date.now()}`,
            alertId: alert.id,
            type: this.getAlertType(alert, change),
            title: this.generateAlertTitle(alert, currentPrice, change),
            message: this.generateAlertMessage(alert, currentPrice, change, percentageChange),
            timestamp: now,
            read: false,
            data: {
                symbol: alert.symbol,
                currentValue: currentPrice,
                threshold: alert.threshold,
                change,
                percentageChange
            },
            channels: this.getActiveNotificationChannels(alert) as ('in_app' | 'email' | 'push' | 'webhook')[]
        };

        // Add to queue
        this.notificationQueue.push(notification);
        
        // Send notifications through active channels
        this.sendNotifications(notification);

        // Add to history
        const historyEntry: AlertHistory = {
            id: `hist_${Date.now()}`,
            alertId: alert.id,
            timestamp: now,
            type: alert.type,
            symbol: alert.symbol,
            currentValue: currentPrice,
            threshold: alert.threshold.value,
            change,
            triggered: true,
            acknowledged: false
        };

        this.alertHistory.unshift(historyEntry);
        
        // Keep history to last 1000 entries
        if (this.alertHistory.length > 1000) {
            this.alertHistory = this.alertHistory.slice(0, 1000);
        }

        this.saveHistoryToStorage();
    }

    /**
     * Detect market conditions like volatility spikes, unusual volume
     */
    private detectMarketConditions(
        prices: Map<string, StockPrice>,
        symbols: string[]
    ): MarketCondition[] {
        const conditions: MarketCondition[] = [];

        symbols.forEach(symbol => {
            const price = prices.get(symbol);
            if (!price) return;

            const history = this.priceHistory.get(symbol) || [];
            if (history.length < 10) return; // Need sufficient history

            const currentPrice = price.price;
            const previousPrice = history[history.length - 2] || currentPrice;
            
            // Detect volatility spike
            const recentPrices = history.slice(-20);
            const avgPrice = recentPrices.reduce((sum, p) => sum + p, 0) / recentPrices.length;
            const volatility = this.calculateVolatility(recentPrices);
            
            if (volatility > this.calculateVolatility(history.slice(-100)) * 2) {
                conditions.push({
                    type: 'volatility_spike',
                    symbol,
                    severity: volatility > avgPrice * 0.05 ? 'high' : 'medium',
                    timestamp: new Date(),
                    details: {
                        currentPrice,
                        previousPrice,
                        volume: 0, // Would need volume data
                        averageVolume: 0,
                        volatility,
                        description: `Volatility spike detected for ${symbol}`
                    }
                });
            }

            // Detect gap up/down
            const gapPercentage = Math.abs((currentPrice - previousPrice) / previousPrice) * 100;
            if (gapPercentage > 5) { // 5% gap
                conditions.push({
                    type: currentPrice > previousPrice ? 'gap_up' : 'gap_down',
                    symbol,
                    severity: gapPercentage > 10 ? 'high' : 'medium',
                    timestamp: new Date(),
                    details: {
                        currentPrice,
                        previousPrice,
                        volume: 0,
                        averageVolume: 0,
                        volatility,
                        description: `${gapPercentage.toFixed(1)}% gap detected for ${symbol}`
                    }
                });
            }
        });

        return conditions;
    }

    /**
     * Calculate price volatility
     */
    private calculateVolatility(prices: number[]): number {
        if (prices.length < 2) return 0;

        const returns = [];
        for (let i = 1; i < prices.length; i++) {
            returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
        }

        const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
        const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
        
        return Math.sqrt(variance) * Math.sqrt(252); // Annualized volatility
    }

    /**
     * Process market conditions
     */
    private processMarketConditions(conditions: MarketCondition[]): void {
        conditions.forEach(condition => {
            if (condition.severity === 'high' && this.settings.notificationChannels.push) {
                const notification: AlertNotification = {
                    id: `market_${Date.now()}`,
                    alertId: `market_${condition.type}`,
                    type: 'warning',
                    title: `Market Alert: ${condition.type.replace('_', ' ').toUpperCase()}`,
                    message: condition.details.description,
                    timestamp: condition.timestamp,
                    read: false,
                    data: {
                        symbol: condition.symbol,
                        currentValue: condition.details.currentPrice,
                        threshold: 0,
                        change: 0
                    },
                    channels: ['in_app']
                };

                this.notificationQueue.push(notification);
                this.sendNotifications(notification);
            }
        });
    }

    /**
     * Get alert type based on price change
     */
    private getAlertType(alert: PriceAlert, change: number): 'info' | 'success' | 'warning' | 'error' {
        if (alert.type === 'portfolio_value') {
            return change > 0 ? 'success' : 'warning';
        }
        
        if (Math.abs(change) / alert.threshold.value > 0.1) {
            return 'warning';
        }
        
        return change > 0 ? 'success' : 'info';
    }

    /**
     * Generate alert title
     */
    private generateAlertTitle(alert: PriceAlert, currentPrice: number, change: number): string {
        const symbol = alert.symbol;
        const changeText = change > 0 ? 'increased' : 'decreased';
        const changeAmount = Math.abs(change).toFixed(2);

        switch (alert.type) {
            case 'price_above':
                return `${symbol} crossed threshold`;
            case 'price_below':
                return `${symbol} dropped below threshold`;
            case 'percentage_change':
                return `${symbol} ${changeText} by ${changeAmount}%`;
            case 'portfolio_value':
                return `Portfolio ${changeText}`;
            default:
                return `Alert for ${symbol}`;
        }
    }

    /**
     * Generate alert message
     */
    private generateAlertMessage(
        alert: PriceAlert,
        currentPrice: number,
        change: number,
        percentageChange: number
    ): string {
        const symbol = alert.symbol;
        const threshold = alert.threshold.value;
        
        switch (alert.type) {
            case 'price_above':
                return `${symbol} reached $${currentPrice.toFixed(2)}, crossing your threshold of $${threshold.toFixed(2)}`;
            case 'price_below':
                return `${symbol} dropped to $${currentPrice.toFixed(2)}, below your threshold of $${threshold.toFixed(2)}`;
            case 'percentage_change':
                const direction = change > 0 ? 'increased' : 'decreased';
                return `${symbol} ${direction} by ${Math.abs(percentageChange).toFixed(2)}% to $${currentPrice.toFixed(2)}`;
            case 'portfolio_value':
                return `Portfolio value changed by ${Math.abs(percentageChange).toFixed(2)}%`;
            default:
                return `Alert triggered for ${symbol}: Current price $${currentPrice.toFixed(2)}`;
        }
    }

    /**
     * Get active notification channels
     */
    private getActiveNotificationChannels(alert: PriceAlert): ('in_app' | 'email' | 'push' | 'webhook')[] {
        const channels: ('in_app' | 'email' | 'push' | 'webhook')[] = [];
        if (this.settings.notificationChannels.in_app) channels.push('in_app');
        if (this.settings.notificationChannels.email) channels.push('email');
        if (this.settings.notificationChannels.push) channels.push('push');
        if (this.settings.notificationChannels.webhook?.enabled) channels.push('webhook');
        return channels;
    }

    /**
     * Send notifications through channels
     */
    private sendNotifications(notification: AlertNotification): void {
        notification.channels.forEach(channel => {
            switch (channel) {
                case 'in_app':
                    this.sendInAppNotification(notification);
                    break;
                case 'email':
                    this.sendEmailNotification(notification);
                    break;
                case 'push':
                    this.sendPushNotification(notification);
                    break;
                case 'webhook':
                    this.sendWebhookNotification(notification);
                    break;
            }
        });
    }

    /**
     * Send in-app notification
     */
    private sendInAppNotification(notification: AlertNotification): void {
        // This would be handled by the UI component
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(notification.title, {
                body: notification.message,
                icon: '/favicon.ico',
                tag: notification.id
            });
        }
    }

    /**
     * Send email notification (placeholder implementation)
     */
    private sendEmailNotification(notification: AlertNotification): void {
        // Integration with email service would go here
        console.log('Email notification:', notification);
    }

    /**
     * Send push notification (placeholder implementation)
     */
    private sendPushNotification(notification: AlertNotification): void {
        // Integration with push service would go here
        console.log('Push notification:', notification);
    }

    /**
     * Send webhook notification (placeholder implementation)
     */
    private sendWebhookNotification(notification: AlertNotification): void {
        if (!this.settings.notificationChannels.webhook?.url) return;

        fetch(this.settings.notificationChannels.webhook.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(notification)
        }).catch(error => {
            console.error('Webhook notification failed:', error);
        });
    }

    /**
     * Create new alert
     */
    createAlert(alert: Omit<PriceAlert, 'id' | 'createdAt' | 'triggeredAt' | 'notificationSent'>): PriceAlert {
        const newAlert: PriceAlert = {
            ...alert,
            id: `alert_${Date.now()}`,
            createdAt: new Date(),
            triggeredAt: undefined,
            notificationSent: false
        };

        this.alerts.set(newAlert.id, newAlert);
        this.saveAlertsToStorage();
        return newAlert;
    }

    /**
     * Update existing alert
     */
    updateAlert(alertId: string, updates: Partial<PriceAlert>): boolean {
        const alert = this.alerts.get(alertId);
        if (!alert) return false;

        const updatedAlert = { ...alert, ...updates };
        this.alerts.set(alertId, updatedAlert);
        this.saveAlertsToStorage();
        return true;
    }

    /**
     * Delete alert
     */
    deleteAlert(alertId: string): boolean {
        const deleted = this.alerts.delete(alertId);
        if (deleted) {
            this.saveAlertsToStorage();
        }
        return deleted;
    }

    /**
     * Get all alerts
     */
    getAlerts(): PriceAlert[] {
        return Array.from(this.alerts.values());
    }

    /**
     * Get alert by ID
     */
    getAlert(alertId: string): PriceAlert | undefined {
        return this.alerts.get(alertId);
    }

    /**
     * Get notification queue
     */
    getNotifications(): AlertNotification[] {
        return this.notificationQueue;
    }

    /**
     * Mark notification as read
     */
    markNotificationRead(notificationId: string): boolean {
        const notification = this.notificationQueue.find(n => n.id === notificationId);
        if (notification) {
            notification.read = true;
            return true;
        }
        return false;
    }

    /**
     * Get alert history
     */
    getAlertHistory(limit: number = 100): AlertHistory[] {
        return this.alertHistory.slice(0, limit);
    }

    /**
     * Update settings
     */
    updateSettings(newSettings: Partial<AlertSettings>): void {
        this.settings = { ...this.settings, ...newSettings };
        this.saveSettingsToStorage();
    }

    /**
     * Storage methods
     */
    private saveAlertsToStorage(): void {
        const alertsArray = Array.from(this.alerts.values());
        localStorage.setItem('f24_price_alerts', JSON.stringify(alertsArray));
    }

    private loadAlertsFromStorage(): void {
        try {
            const stored = localStorage.getItem('f24_price_alerts');
            if (stored) {
                const alertsArray = JSON.parse(stored) as PriceAlert[];
                alertsArray.forEach(alert => {
                    alert.createdAt = new Date(alert.createdAt);
                    alert.triggeredAt = alert.triggeredAt ? new Date(alert.triggeredAt) : undefined;
                    this.alerts.set(alert.id, alert);
                });
            }
        } catch (error) {
            console.error('Failed to load alerts from storage:', error);
        }
    }

    private saveHistoryToStorage(): void {
        localStorage.setItem('f24_alert_history', JSON.stringify(this.alertHistory));
    }

    private loadHistoryFromStorage(): void {
        try {
            const stored = localStorage.getItem('f24_alert_history');
            if (stored) {
                this.alertHistory = JSON.parse(stored).map((entry: any) => ({
                    ...entry,
                    timestamp: new Date(entry.timestamp)
                }));
            }
        } catch (error) {
            console.error('Failed to load alert history:', error);
        }
    }

    private saveSettingsToStorage(): void {
        localStorage.setItem('f24_alert_settings', JSON.stringify(this.settings));
    }

    /**
     * Get default alert settings
     */
    static getDefaultSettings(): AlertSettings {
        return {
            enabled: true,
            defaultCurrency: 'USD',
            notificationChannels: {
                in_app: true,
                email: false,
                push: false,
                webhook: {
                    url: '',
                    enabled: false
                }
            },
            quietHours: {
                enabled: false,
                start: '22:00',
                end: '08:00'
            },
            cooldownPeriod: 5, // 5 minutes
            maxAlertsPerDay: 50,
            soundEnabled: true,
            desktopNotifications: true
        };
    }

    /**
     * Get popular alert templates
     */
    static getAlertTemplates(): AlertTemplate[] {
        return [
            {
                id: 'price_above_52w_high',
                name: '52-Week High Breakout',
                description: 'Alert when stock breaks 52-week high',
                template: {
                    id: '',
                    symbol: '',
                    type: 'price_above',
                    isActive: false,
                    threshold: 0,
                    currency: 'USD',
                    condition: {
                        operator: '>',
                        value: 0
                    },
                    createdAt: new Date(),
                    notificationSent: false
                },
                category: 'price',
                popular: true
            },
            {
                id: 'price_drop_10_percent',
                name: '10% Price Drop',
                description: 'Alert when stock drops 10% from current level',
                template: {
                    id: '',
                    symbol: '',
                    type: 'percentage_change',
                    isActive: false,
                    threshold: 10,
                    currency: 'USD',
                    condition: {
                        operator: 'percentage',
                        value: -10
                    },
                    createdAt: new Date(),
                    notificationSent: false
                },
                category: 'price',
                popular: true
            },
            {
                id: 'portfolio_value_change',
                name: 'Portfolio Value Change',
                description: 'Alert when portfolio value changes significantly',
                template: {
                    id: '',
                    symbol: '',
                    type: 'portfolio_value',
                    isActive: false,
                    threshold: 5,
                    currency: 'USD',
                    condition: {
                        operator: 'percentage',
                        value: 5
                    },
                    createdAt: new Date(),
                    notificationSent: false
                },
                category: 'portfolio',
                popular: true
            }
        ];
    }
}