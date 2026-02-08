/**
 * Notification System
 * Handles in-app, desktop, and push notifications
 */

import { AlertNotification, AlertSettings } from '../types';

export class NotificationSystem {
    private settings: AlertSettings;
    private notificationQueue: AlertNotification[] = [];
    private isPermissionGranted = false;

    constructor(settings: AlertSettings) {
        this.settings = settings;
        this.requestPermissions();
        this.setupServiceWorker();
    }

    /**
     * Request notification permissions
     */
    private async requestPermissions(): Promise<void> {
        if ('Notification' in window) {
            const permission = await Notification.requestPermission();
            this.isPermissionGranted = permission === 'granted';
            
            if (permission === 'denied') {
                console.warn('Notification permission denied');
            }
        }

        // Request desktop notification permissions if available
        if ('permissions' in navigator && 'notifications' in navigator.permissions) {
            try {
                const result = await navigator.permissions.query({ name: 'notifications' });
                this.isPermissionGranted = result.state === 'granted';
            } catch (error) {
                console.warn('Permission API not available:', error);
            }
        }
    }

    /**
     * Setup service worker for background notifications
     */
    private setupServiceWorker(): void {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/notification-sw.js')
                .then(registration => {
                    console.log('Service Worker registered for notifications:', registration);
                })
                .catch(error => {
                    console.error('Service Worker registration failed:', error);
                });
        }
    }

    /**
     * Show in-app notification
     */
    showInAppNotification(notification: AlertNotification): void {
        // Add to queue for UI display
        this.notificationQueue.push(notification);
        
        // Trigger custom event for UI components
        window.dispatchEvent(new CustomEvent('f24-notification', {
            detail: notification
        }));

        // Also show browser notification if page is not visible
        if (document.hidden && this.settings.desktopNotifications) {
            this.showDesktopNotification(notification);
        }
    }

    /**
     * Show desktop notification
     */
    showDesktopNotification(notification: AlertNotification): void {
        if (!this.isPermissionGranted) return;

        if ('Notification' in window) {
            const browserNotification = new Notification(notification.title, {
                body: notification.message,
                icon: '/favicon.ico',
                badge: '/favicon.ico',
                tag: notification.id,
                requireInteraction: false,
                silent: !this.settings.soundEnabled
            });

            // Handle click events
            browserNotification.onclick = () => {
                // Focus the window and handle click
                window.focus();
                
                // Navigate to relevant section
                if (notification.data.symbol) {
                    window.location.hash = `alerts-${notification.data.symbol}`;
                }
                
                browserNotification.close();
            };

            // Auto-close after 5 seconds
            setTimeout(() => {
                if (browserNotification.close) {
                    browserNotification.close();
                }
            }, 5000);
        }
    }

    /**
     * Show push notification (integration with push service)
     */
    async showPushNotification(notification: AlertNotification): Promise<void> {
        // This would integrate with your push notification service
        try {
            if ('PushManager' in window) {
                const registration = await navigator.serviceWorker.getRegistration();
                if (registration) {
                    // Send message to service worker to show push notification
                    registration.active?.postMessage({
                        type: 'PUSH_NOTIFICATION',
                        payload: notification
                    });
                }
            }
        } catch (error) {
            console.error('Push notification failed:', error);
        }
    }

    /**
     * Check if in quiet hours
     */
    private isQuietHours(): boolean {
        if (!this.settings.quietHours.enabled) return false;

        const now = new Date();
        const currentTime = now.getHours() * 60 + now.getMinutes();
        
        const [startHour, startMin] = this.settings.quietHours.start.split(':').map(Number);
        const [endHour, endMin] = this.settings.quietHours.end.split(':').map(Number);
        
        const startTime = startHour * 60 + startMin;
        const endTime = endHour * 60 + endMin;

        if (startTime <= endTime) {
            return currentTime >= startTime && currentTime <= endTime;
        } else {
            // Handle overnight quiet hours (e.g., 22:00 - 08:00)
            return currentTime >= startTime || currentTime <= endTime;
        }
    }

    /**
     * Process notification based on settings and channels
     */
    async processNotification(notification: AlertNotification): Promise<void> {
        // Check quiet hours
        if (this.isQuietHours() && !notification.channels.includes('in_app')) {
            console.log('Notification suppressed due to quiet hours');
            return;
        }

        // Check cooldown period
        if (this.isInCooldown(notification)) {
            console.log('Notification suppressed due to cooldown');
            return;
        }

        // Check daily limit
        if (this.isDailyLimitExceeded()) {
            console.log('Notification suppressed due to daily limit');
            return;
        }

        // Send through appropriate channels
        const promises: Promise<void>[] = [];

        if (notification.channels.includes('in_app')) {
            this.showInAppNotification(notification);
        }

        if (notification.channels.includes('push') && this.settings.notificationChannels.push) {
            promises.push(this.showPushNotification(notification));
        }

        if (notification.channels.includes('webhook') && this.settings.notificationChannels.webhook?.enabled) {
            promises.push(this.sendWebhookNotification(notification));
        }

        if (notification.channels.includes('email') && this.settings.notificationChannels.email) {
            promises.push(this.sendEmailNotification(notification));
        }

        // Show desktop notification for any non-in-app notification if enabled
        if (!notification.channels.includes('in_app') && this.settings.desktopNotifications) {
            this.showDesktopNotification(notification);
        }

        await Promise.allSettled(promises);
    }

    /**
     * Check if notification is in cooldown period
     */
    private isInCooldown(notification: AlertNotification): boolean {
        const recentNotifications = this.notificationQueue
            .filter(n => n.data.symbol === notification.data.symbol)
            .slice(-10); // Check last 10 notifications

        if (recentNotifications.length === 0) return false;

        const lastNotification = recentNotifications[recentNotifications.length - 1];
        const timeSinceLast = Date.now() - lastNotification.timestamp.getTime();
        
        return timeSinceLast < this.settings.cooldownPeriod * 60 * 1000;
    }

    /**
     * Check if daily limit is exceeded
     */
    private isDailyLimitExceeded(): boolean {
        const today = new Date().toDateString();
        const todayNotifications = this.notificationQueue.filter(
            n => n.timestamp.toDateString() === today
        );

        return todayNotifications.length >= this.settings.maxAlertsPerDay;
    }

    /**
     * Send webhook notification
     */
    private async sendWebhookNotification(notification: AlertNotification): Promise<void> {
        if (!this.settings.notificationChannels.webhook?.url) return;

        try {
            const response = await fetch(this.settings.notificationChannels.webhook.url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Freedom24-Alerts/1.0'
                },
                body: JSON.stringify({
                    id: notification.id,
                    type: notification.type,
                    title: notification.title,
                    message: notification.message,
                    timestamp: notification.timestamp.toISOString(),
                    data: notification.data
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            console.log('Webhook notification sent successfully');
        } catch (error) {
            console.error('Webhook notification failed:', error);
            throw error;
        }
    }

    /**
     * Send email notification (placeholder implementation)
     */
    private async sendEmailNotification(notification: AlertNotification): Promise<void> {
        // Integration with your email service would go here
        console.log('Email notification:', notification);
        
        // Example implementation with EmailJS or similar service:
        /*
        try {
            await emailjs.send({
                service: 'your_service',
                template: 'alert_notification',
                template_params: {
                    title: notification.title,
                    message: notification.message,
                    symbol: notification.data.symbol,
                    current_value: notification.data.currentValue,
                    threshold: notification.data.threshold
                }
            });
        } catch (error) {
            console.error('Email notification failed:', error);
        }
        */
    }

    /**
     * Get notification queue
     */
    getNotifications(): AlertNotification[] {
        return this.notificationQueue;
    }

    /**
     * Clear notifications
     */
    clearNotifications(): void {
        this.notificationQueue = [];
        
        // Trigger event for UI update
        window.dispatchEvent(new CustomEvent('f24-notifications-cleared'));
    }

    /**
     * Mark notification as read
     */
    markAsRead(notificationId: string): boolean {
        const notification = this.notificationQueue.find(n => n.id === notificationId);
        if (notification) {
            notification.read = true;
            return true;
        }
        return false;
    }

    /**
     * Get unread count
     */
    getUnreadCount(): number {
        return this.notificationQueue.filter(n => !n.read).length;
    }

    /**
     * Update settings
     */
    updateSettings(newSettings: Partial<AlertSettings>): void {
        this.settings = { ...this.settings, ...newSettings };
        this.requestPermissions(); // Re-check permissions
    }

    /**
     * Get browser notification support
     */
    static getBrowserSupport(): {
        notifications: boolean;
        push: boolean;
        serviceWorker: boolean;
        permissions: boolean;
    } {
        return {
            notifications: 'Notification' in window,
            push: 'PushManager' in window,
            serviceWorker: 'serviceWorker' in navigator,
            permissions: 'permissions' in navigator
        };
    }

    /**
     * Test notification system
     */
    async testNotification(): Promise<boolean> {
        try {
            const testNotification: AlertNotification = {
                id: `test_${Date.now()}`,
                alertId: 'test',
                type: 'info',
                title: 'Test Notification',
                message: 'This is a test notification from Freedom24 Alerts.',
                timestamp: new Date(),
                read: false,
                data: {
                    symbol: 'TEST',
                    currentValue: 100,
                    threshold: 95,
                    change: 5
                },
                channels: ['in_app']
            };

            await this.processNotification(testNotification);
            return true;
        } catch (error) {
            console.error('Test notification failed:', error);
            return false;
        }
    }
}