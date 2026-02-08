
/**
 * Exchange Rate Service
 * Fetches current exchange rates from a free API
 * Uses exchangerate-api.com (free tier: 1500 requests/month)
 */

export interface ExchangeRateData {
    rates: Record<string, number>;
    base: string;
    timestamp: number;
    lastUpdated: Date;
}

const CACHE_KEY = 'f24_exchange_rate_cache';
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Fetch exchange rates from API
 * Using exchangerate-api.com free tier (no API key required)
 */
export async function fetchExchangeRates(baseCurrency: string = 'USD'): Promise<Record<string, number>> {
    try {
        const response = await fetch(`https://api.exchangerate-api.com/v4/latest/${baseCurrency}`);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (!data.rates) {
            throw new Error('Invalid response format from exchange rate API');
        }

        // Cache the result
        const cacheData: ExchangeRateData = {
            rates: data.rates,
            base: baseCurrency,
            timestamp: Date.now(),
            lastUpdated: new Date()
        };

        if (typeof window !== 'undefined') {
            localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
        }

        return data.rates;
    } catch (error) {
        console.error('Failed to fetch exchange rates:', error);

        // Try to use cached rates as fallback
        const cached = getCachedRates();
        if (cached) {
            console.warn('Using cached exchange rates due to API failure');
            return cached.rates;
        }

        throw error;
    }
}

/**
 * Get cached exchange rates from localStorage
 */
export function getCachedRates(): ExchangeRateData | null {
    if (typeof window === 'undefined') return null;

    try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (!cached) return null;

        const data: ExchangeRateData = JSON.parse(cached);
        data.lastUpdated = new Date(data.lastUpdated);

        return data;
    } catch (error) {
        console.error('Failed to parse cached exchange rates:', error);
        return null;
    }
}

/**
 * Check if cached rates should be refreshed
 */
export function shouldRefreshRates(): boolean {
    const cached = getCachedRates();
    if (!cached) return true;

    const age = Date.now() - cached.timestamp;
    return age > CACHE_DURATION_MS;
}

/**
 * Get exchange rates (from cache if fresh, otherwise fetch)
 */
export async function getExchangeRates(baseCurrency: string = 'USD', forceRefresh: boolean = false): Promise<{
    rates: Record<string, number>;
    fromCache: boolean;
    lastUpdated: Date;
}> {
    if (!forceRefresh && !shouldRefreshRates()) {
        const cached = getCachedRates();
        if (cached && cached.base === baseCurrency) {
            return {
                rates: cached.rates,
                fromCache: true,
                lastUpdated: cached.lastUpdated
            };
        }
    }

    const rates = await fetchExchangeRates(baseCurrency);
    return {
        rates,
        fromCache: false,
        lastUpdated: new Date()
    };
}

/**
 * Clear cached exchange rates
 */
export function clearRateCache(): void {
    if (typeof window !== 'undefined') {
        localStorage.removeItem(CACHE_KEY);
    }
}
