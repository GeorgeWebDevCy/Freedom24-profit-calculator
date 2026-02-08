
/**
 * Stock Price Service
 * Fetches real-time stock prices using Yahoo Finance API
 * Uses a free, no-auth-required endpoint
 */

export interface StockPrice {
    symbol: string;
    price: number;
    currency: string;
    timestamp: Date;
    source: 'API' | 'CACHE' | 'FALLBACK';
}

export interface PriceCacheEntry {
    price: number;
    currency: string;
    timestamp: number;
}

const PRICE_CACHE_KEY = 'f24_stock_prices_cache';
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch stock price from Yahoo Finance API
 * Using a free proxy endpoint that doesn't require authentication
 */
async function fetchSinglePrice(symbol: string): Promise<StockPrice | null> {
    try {
        // Using Yahoo Finance query API (free, no auth required)
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;

        const response = await fetch(url);

        if (!response.ok) {
            console.warn(`Failed to fetch price for ${symbol}: ${response.status}`);
            return null;
        }

        const data = await response.json();

        // Extract price from response
        const result = data?.chart?.result?.[0];
        if (!result) {
            console.warn(`No data found for ${symbol}`);
            return null;
        }

        const meta = result.meta;
        const price = meta?.regularMarketPrice;
        const currency = meta?.currency || 'USD';

        if (typeof price !== 'number' || !isFinite(price)) {
            console.warn(`Invalid price for ${symbol}:`, price);
            return null;
        }

        return {
            symbol,
            price,
            currency,
            timestamp: new Date(),
            source: 'API'
        };
    } catch (error) {
        console.error(`Error fetching price for ${symbol}:`, error);
        return null;
    }
}

/**
 * Fetch prices for multiple stocks with rate limiting
 */
export async function fetchStockPrices(symbols: string[]): Promise<Map<string, StockPrice>> {
    const results = new Map<string, StockPrice>();
    const cache = getPriceCache();

    // Filter out symbols we have fresh cache for
    const symbolsToFetch: string[] = [];
    const now = Date.now();

    for (const symbol of symbols) {
        const cached = cache.get(symbol);
        if (cached && (now - cached.timestamp) < CACHE_DURATION_MS) {
            // Use cached price
            results.set(symbol, {
                symbol,
                price: cached.price,
                currency: cached.currency,
                timestamp: new Date(cached.timestamp),
                source: 'CACHE'
            });
        } else {
            symbolsToFetch.push(symbol);
        }
    }

    // Fetch prices with delay to avoid rate limiting
    for (let i = 0; i < symbolsToFetch.length; i++) {
        const symbol = symbolsToFetch[i];

        // Add delay between requests (100ms)
        if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        const price = await fetchSinglePrice(symbol);
        if (price) {
            results.set(symbol, price);

            // Update cache
            cache.set(symbol, {
                price: price.price,
                currency: price.currency,
                timestamp: price.timestamp.getTime()
            });
        }
    }

    // Save updated cache
    savePriceCache(cache);

    return results;
}

/**
 * Get cached prices from localStorage
 */
function getPriceCache(): Map<string, PriceCacheEntry> {
    if (typeof window === 'undefined') return new Map();

    try {
        const cached = localStorage.getItem(PRICE_CACHE_KEY);
        if (!cached) return new Map();

        const data = JSON.parse(cached);
        return new Map(Object.entries(data));
    } catch (error) {
        console.error('Failed to parse price cache:', error);
        return new Map();
    }
}

/**
 * Save price cache to localStorage
 */
function savePriceCache(cache: Map<string, PriceCacheEntry>): void {
    if (typeof window === 'undefined') return;

    try {
        const data = Object.fromEntries(cache);
        localStorage.setItem(PRICE_CACHE_KEY, JSON.stringify(data));
    } catch (error) {
        console.error('Failed to save price cache:', error);
    }
}

/**
 * Clear price cache
 */
export function clearPriceCache(): void {
    if (typeof window !== 'undefined') {
        localStorage.removeItem(PRICE_CACHE_KEY);
    }
}

/**
 * Get cache age for a symbol (in milliseconds)
 */
export function getCacheAge(symbol: string): number | null {
    const cache = getPriceCache();
    const entry = cache.get(symbol);
    if (!entry) return null;

    return Date.now() - entry.timestamp;
}
