/**
 * Advanced Search Service
 * Comprehensive search and filtering system for portfolio data
 */

import { 
    SearchQuery, 
    SearchFilters, 
    SearchResult, 
    SavedSearch, 
    SearchAnalytics,
    AdvancedSearchOperators,
    Trade, 
    ClosedTrade, 
    Dividend, 
    FeeRecord, 
    Lot,
    CalculationResult,
    TradeDirection
} from '../types';

export class SearchService {
    private searchHistory: SearchQuery[] = [];
    private savedSearches: SavedSearch[] = [];
    private searchAnalytics: SearchAnalytics;
    private index: Map<string, SearchResult[]> = new Map();

    constructor() {
        this.searchAnalytics = {
            totalSearches: 0,
            popularQueries: [],
            searchTrends: [],
            averageResultCount: 0,
            searchSuccessRate: 0
        };
        this.loadSearchData();
    }

    /**
     * Perform advanced search with filters
     */
    async search(query: SearchQuery, data: CalculationResult): Promise<SearchResult[]> {
        const startTime = Date.now();
        
        // Update analytics
        this.searchAnalytics.totalSearches++;
        this.updateSearchTrends(query.query);

        // Build search index if not exists
        if (this.index.size === 0) {
            this.buildSearchIndex(data);
        }

        let results: SearchResult[] = [];

        // Perform search based on query type
        switch (query.type) {
            case 'text':
                results = this.performTextSearch(query, data);
                break;
            case 'ticker':
                results = this.performTickerSearch(query, data);
                break;
            case 'advanced':
                results = this.performAdvancedSearch(query, data);
                break;
        }

        // Apply filters
        if (query.filters) {
            results = this.applyFilters(results, query.filters);
        }

        // Calculate relevance scores
        results = this.calculateRelevanceScores(results, query);

        // Sort by relevance
        results.sort((a, b) => b.relevanceScore - a.relevanceScore);

        // Update search query with results
        query.results = results;
        query.timestamp = new Date();

        // Add to history
        this.searchHistory.unshift(query);
        if (this.searchHistory.length > 1000) {
            this.searchHistory = this.searchHistory.slice(0, 1000);
        }

        // Update analytics
        this.updateAnalytics(results, Date.now() - startTime);
        this.saveSearchData();

        return results;
    }

    /**
     * Build search index for fast searching
     */
    private buildSearchIndex(data: CalculationResult): void {
        this.index.clear();

        // Index trades
        data.closed_trades.forEach((trade, index) => {
            const result: SearchResult = {
                id: `trade_${index}`,
                type: 'trade',
                title: `${trade.ticker} - Trade`,
                description: `${trade.quantity} shares at ${trade.sell_price} on ${trade.date.toLocaleDateString()}`,
                data: trade,
                timestamp: trade.date,
                relevanceScore: 0
            };

            const keywords = this.extractKeywords(result);
            keywords.forEach(keyword => {
                if (!this.index.has(keyword)) {
                    this.index.set(keyword, []);
                }
                this.index.get(keyword)!.push(result);
            });
        });

        // Index open positions
        Object.entries(data.open_positions).forEach(([ticker, lots], index) => {
            const totalQuantity = lots.reduce((sum, lot) => sum + lot.quantity, 0);
            const totalCost = lots.reduce((sum, lot) => sum + lot.price_paid, 0);
            const avgCost = totalQuantity > 0 ? totalCost / totalQuantity : 0;

            const result: SearchResult = {
                id: `position_${index}`,
                type: 'position',
                title: `${ticker} - Open Position`,
                description: `${totalQuantity} shares, avg cost ${avgCost.toFixed(2)}`,
                data: { ticker, lots, totalQuantity, avgCost },
                timestamp: new Date(),
                relevanceScore: 0
            };

            const keywords = this.extractKeywords(result);
            keywords.forEach(keyword => {
                if (!this.index.has(keyword)) {
                    this.index.set(keyword, []);
                }
                this.index.get(keyword)!.push(result);
            });
        });

        // Index dividends
        data.dividends.forEach((dividend, index) => {
            const result: SearchResult = {
                id: `dividend_${index}`,
                type: 'dividend',
                title: `Dividend - ${dividend.description}`,
                description: `${dividend.amount} on ${dividend.date.toLocaleDateString()}`,
                data: dividend,
                timestamp: dividend.date,
                relevanceScore: 0
            };

            const keywords = this.extractKeywords(result);
            keywords.forEach(keyword => {
                if (!this.index.has(keyword)) {
                    this.index.set(keyword, []);
                }
                this.index.get(keyword)!.push(result);
            });
        });

        // Index fees
        data.fees.forEach((fee, index) => {
            const result: SearchResult = {
                id: `fee_${index}`,
                type: 'fee',
                title: `Fee - ${fee.description}`,
                description: `${fee.amount} on ${fee.date.toLocaleDateString()}`,
                data: fee,
                timestamp: fee.date,
                relevanceScore: 0
            };

            const keywords = this.extractKeywords(result);
            keywords.forEach(keyword => {
                if (!this.index.has(keyword)) {
                    this.index.set(keyword, []);
                }
                this.index.get(keyword)!.push(result);
            });
        });
    }

    /**
     * Extract keywords from search result
     */
    private extractKeywords(result: SearchResult): string[] {
        const keywords = new Set<string>();
        
        // Add ticker symbols
        if (result.data.ticker) {
            keywords.add(result.data.ticker.toLowerCase());
        }

        // Add words from title and description
        const text = `${result.title} ${result.description}`.toLowerCase();
        const words = text.split(/\s+/).filter(word => word.length > 2);
        words.forEach(word => keywords.add(word));

        // Add numbers and dates
        const numbers = text.match(/\d+/g) || [];
        numbers.forEach(num => keywords.add(num));

        // Add type-specific keywords
        keywords.add(result.type);

        return Array.from(keywords);
    }

    /**
     * Perform text search
     */
    private performTextSearch(query: SearchQuery, data: CalculationResult): SearchResult[] {
        const searchTerms = query.query.toLowerCase().split(/\s+/);
        const results: SearchResult[] = [];
        const matchedResults = new Set<string>();

        searchTerms.forEach(term => {
            const termResults = this.index.get(term) || [];
            termResults.forEach(result => {
                if (!matchedResults.has(result.id)) {
                    results.push(result);
                    matchedResults.add(result.id);
                }
            });
        });

        return results;
    }

    /**
     * Perform ticker-specific search
     */
    private performTickerSearch(query: SearchQuery, data: CalculationResult): SearchResult[] {
        const ticker = query.query.toUpperCase();
        const results: SearchResult[] = [];

        // Search trades
        data.closed_trades.forEach((trade, index) => {
            if (trade.ticker === ticker) {
                results.push({
                    id: `trade_${index}`,
                    type: 'trade',
                title: `${trade.ticker} - ${trade.method} - ${trade.date.toLocaleDateString()}`,
                description: `${trade.quantity} shares at ${trade.sell_price} on ${trade.date.toLocaleDateString()} (Method: ${trade.method})`,
                    data: trade,
                    timestamp: trade.date,
                    relevanceScore: 0
                });
            }
        });

        // Search open positions
        if (data.open_positions[ticker]) {
            const lots = data.open_positions[ticker];
            const totalQuantity = lots.reduce((sum, lot) => sum + lot.quantity, 0);
            const totalCost = lots.reduce((sum, lot) => sum + lot.price_paid, 0);
            const avgCost = totalQuantity > 0 ? totalCost / totalQuantity : 0;

            results.push({
                id: `position_${ticker}`,
                type: 'position',
                title: `${ticker} - Open Position`,
                description: `${totalQuantity} shares, avg cost ${avgCost.toFixed(2)}`,
                data: { ticker, lots, totalQuantity, avgCost },
                timestamp: new Date(),
                relevanceScore: 0
            });
        }

        return results;
    }

    /**
     * Perform advanced search with complex operators
     */
    private performAdvancedSearch(query: SearchQuery, data: CalculationResult): SearchResult[] {
        // Parse advanced query syntax
        const parsedQuery = this.parseAdvancedQuery(query.query);
        
        // Start with all results
        let results: SearchResult[] = [];
        
        // Collect all possible results
        data.closed_trades.forEach((trade, index) => {
            results.push({
                id: `trade_${index}`,
                type: 'trade',
                title: `${trade.ticker} - ${trade.method}`,
                description: `${trade.quantity} shares at ${trade.sell_price}`,
                data: trade,
                timestamp: trade.date,
                relevanceScore: 0
            });
        });

        // Apply advanced filters
        results = results.filter(result => this.matchesAdvancedQuery(result, parsedQuery));

        return results;
    }

    /**
     * Parse advanced query syntax
     */
    private parseAdvancedQuery(query: string): any {
        // Simple implementation - could be extended with proper parser
        const parsed: any = {
            terms: [],
            operators: {},
            filters: {}
        };

        // Extract quoted phrases
        const quotedPhrases = query.match(/"([^"]+)"/g) || [];
        quotedPhrases.forEach(phrase => {
            parsed.terms.push(phrase.replace(/"/g, ''));
        });

        // Extract unquoted terms
        const unquoted = query.replace(/"[^"]+"/g, '').trim();
        if (unquoted) {
            parsed.terms.push(...unquoted.split(/\s+/));
        }

        // Extract operators (simple implementation)
        if (query.includes('AND')) parsed.operators.boolean = { and: true };
        if (query.includes('OR')) parsed.operators.boolean = { or: true };
        if (query.includes('NOT')) parsed.operators.boolean = { not: true };

        return parsed;
    }

    /**
     * Check if result matches advanced query
     */
    private matchesAdvancedQuery(result: SearchResult, parsedQuery: any): boolean {
        const searchText = `${result.title} ${result.description}`.toLowerCase();
        
        // Check if any term matches
        const hasMatchingTerm = parsedQuery.terms.some((term: string) => 
            searchText.includes(term.toLowerCase())
        );

        // Apply boolean operators
        if (parsedQuery.operators.boolean?.not) {
            return !hasMatchingTerm;
        }

        return hasMatchingTerm;
    }

    /**
     * Apply filters to search results
     */
    private applyFilters(results: SearchResult[], filters: SearchFilters): SearchResult[] {
        return results.filter(result => {
            // Date range filter
            if (filters.dateRange) {
                const resultDate = result.timestamp;
                if (resultDate < filters.dateRange.start || resultDate > filters.dateRange.end) {
                    return false;
                }
            }

            // Price range filter
            if (filters.priceRange && result.data.price) {
                const price = result.data.price;
                if (price < filters.priceRange.min || price > filters.priceRange.max) {
                    return false;
                }
            }

            // Performance filter
            if (filters.performance && result.data.realized_profit !== undefined) {
                const profit = result.data.realized_profit;
                if (profit < filters.performance.minReturn || profit > filters.performance.maxReturn) {
                    return false;
                }
            }

            // Type filter
            if (filters.assetTypes && filters.assetTypes.length > 0) {
                if (!filters.assetTypes.includes(result.type)) {
                    return false;
                }
            }

            return true;
        });
    }

    /**
     * Calculate relevance scores for search results
     */
    private calculateRelevanceScores(results: SearchResult[], query: SearchQuery): SearchResult[] {
        return results.map(result => {
            let score = 0;
            const searchText = `${result.title} ${result.description}`.toLowerCase();
            const queryTerms = query.query.toLowerCase().split(/\s+/);

            // Exact match bonus
            if (searchText === query.query.toLowerCase()) {
                score += 100;
            }

            // Term matching bonus
            queryTerms.forEach(term => {
                if (searchText.includes(term)) {
                    score += 10;
                }
            });

            // Title match bonus
            if (result.title.toLowerCase().includes(query.query.toLowerCase())) {
                score += 20;
            }

            // Type-specific bonuses
            if (result.type === 'trade' && query.query.toLowerCase().includes('trade')) {
                score += 15;
            }
            if (result.type === 'position' && query.query.toLowerCase().includes('position')) {
                score += 15;
            }

            // Recency bonus (more recent results get higher scores)
            const daysSince = (Date.now() - result.timestamp.getTime()) / (1000 * 60 * 60 * 24);
            score += Math.max(0, 10 - daysSince);

            result.relevanceScore = score;
            return result;
        });
    }

    /**
     * Save search query
     */
    saveSearch(name: string, query: SearchQuery): SavedSearch {
        const savedSearch: SavedSearch = {
            id: `saved_${Date.now()}`,
            name,
            query: { ...query, saved: true },
            timestamp: new Date(),
            useCount: 0,
            pinned: false
        };

        this.savedSearches.push(savedSearch);
        this.saveSearchData();
        return savedSearch;
    }

    /**
     * Get saved searches
     */
    getSavedSearches(): SavedSearch[] {
        return this.savedSearches.sort((a, b) => {
            // Pinned searches first
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;
            // Then by last used
            if (a.lastUsed && b.lastUsed) {
                return b.lastUsed.getTime() - a.lastUsed.getTime();
            }
            // Then by use count
            return b.useCount - a.useCount;
        });
    }

    /**
     * Delete saved search
     */
    deleteSavedSearch(searchId: string): boolean {
        const index = this.savedSearches.findIndex(s => s.id === searchId);
        if (index !== -1) {
            this.savedSearches.splice(index, 1);
            this.saveSearchData();
            return true;
        }
        return false;
    }

    /**
     * Get search suggestions
     */
    getSearchSuggestions(query: string, limit: number = 10): string[] {
        const suggestions = new Set<string>();
        const queryLower = query.toLowerCase();

        // Get from search history
        this.searchHistory
            .filter(h => h.query.toLowerCase().includes(queryLower))
            .slice(0, limit)
            .forEach(h => suggestions.add(h.query));

        // Get from popular queries
        this.searchAnalytics.popularQueries
            .filter(p => p.query.toLowerCase().includes(queryLower))
            .slice(0, limit)
            .forEach(p => suggestions.add(p.query));

        return Array.from(suggestions).slice(0, limit);
    }

    /**
     * Get search analytics
     */
    getSearchAnalytics(): SearchAnalytics {
        return this.searchAnalytics;
    }

    /**
     * Update search analytics
     */
    private updateAnalytics(results: SearchResult[], searchTime: number): void {
        // Update average result count
        const totalResults = this.searchAnalytics.totalSearches;
        const currentAvg = this.searchAnalytics.averageResultCount;
        this.searchAnalytics.averageResultCount = 
            (currentAvg * (totalResults - 1) + results.length) / totalResults;

        // Update success rate (consider search successful if results found)
        const successRate = results.length > 0 ? 1 : 0;
        this.searchAnalytics.searchSuccessRate = 
            (this.searchAnalytics.searchSuccessRate * (totalResults - 1) + successRate) / totalResults;
    }

    /**
     * Update search trends
     */
    private updateSearchTrends(query: string): void {
        const term = query.toLowerCase().trim();
        if (!term) return;

        const existing = this.searchAnalytics.searchTrends.find(t => t.term === term);
        if (existing) {
            existing.frequency++;
        } else {
            this.searchAnalytics.searchTrends.push({ term, frequency: 1 });
        }

        // Keep only top 100 trends
        this.searchAnalytics.searchTrends.sort((a, b) => b.frequency - a.frequency);
        this.searchAnalytics.searchTrends = this.searchAnalytics.searchTrends.slice(0, 100);
    }

    /**
     * Load search data from localStorage
     */
    private loadSearchData(): void {
        try {
            // Load search history
            const historyData = localStorage.getItem('f24_search_history');
            if (historyData) {
                this.searchHistory = JSON.parse(historyData).map((h: any) => ({
                    ...h,
                    timestamp: new Date(h.timestamp)
                }));
            }

            // Load saved searches
            const savedData = localStorage.getItem('f24_saved_searches');
            if (savedData) {
                this.savedSearches = JSON.parse(savedData).map((s: any) => ({
                    ...s,
                    timestamp: new Date(s.timestamp),
                    lastUsed: s.lastUsed ? new Date(s.lastUsed) : undefined
                }));
            }

            // Load analytics
            const analyticsData = localStorage.getItem('f24_search_analytics');
            if (analyticsData) {
                this.searchAnalytics = JSON.parse(analyticsData);
            }
        } catch (error) {
            console.error('Failed to load search data:', error);
        }
    }

    /**
     * Save search data to localStorage
     */
    private saveSearchData(): void {
        try {
            localStorage.setItem('f24_search_history', JSON.stringify(this.searchHistory));
            localStorage.setItem('f24_saved_searches', JSON.stringify(this.savedSearches));
            localStorage.setItem('f24_search_analytics', JSON.stringify(this.searchAnalytics));
        } catch (error) {
            console.error('Failed to save search data:', error);
        }
    }

    /**
     * Clear search data
     */
    clearSearchData(): void {
        this.searchHistory = [];
        this.savedSearches = [];
        this.searchAnalytics = {
            totalSearches: 0,
            popularQueries: [],
            searchTrends: [],
            averageResultCount: 0,
            searchSuccessRate: 0
        };
        this.saveSearchData();
    }

    /**
     * Get default search filters
     */
    static getDefaultFilters(): SearchFilters {
        return {
            dateRange: {
                start: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // 1 year ago
                end: new Date()
            },
            assetTypes: ['trade', 'position', 'dividend', 'fee'],
            priceRange: {
                min: 0,
                max: 1000000
            },
            performance: {
                minReturn: -1000000,
                maxReturn: 1000000,
                minVolatility: 0,
                maxVolatility: 100
            }
        };
    }
}