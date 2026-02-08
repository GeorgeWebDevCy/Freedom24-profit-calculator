import React, { useState, useEffect, useRef } from 'react';
import { SearchQuery, SearchFilters, SearchResult, SavedSearch, SearchAnalytics } from '../../lib/types';
import { SearchService } from '../../lib/services/search.service';
import { 
    Search, 
    Filter, 
    Plus, 
    X, 
    Save, 
    Clock, 
    TrendingUp, 
    Star, 
    Trash2, 
    ChevronDown,
    ChevronUp,
    Settings,
    RefreshCw,
    Calendar,
    BarChart3
} from 'lucide-react';

interface SearchPanelProps {
    data: any;
    onSearchComplete?: (results: SearchResult[]) => void;
}

export const SearchPanel: React.FC<SearchPanelProps> = ({ data, onSearchComplete }) => {
    const [query, setQuery] = useState<SearchQuery>({ 
        id: Date.now().toString(),
        query: '',
        type: 'text',
        filters: SearchService.getDefaultFilters(),
        timestamp: new Date(),
        saved: false
    });
    const [results, setResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const [showSaved, setShowSaved] = useState(false);
    const [searchHistory, setSearchHistory] = useState<string[]>([]);
    const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
    const [analytics, setAnalytics] = useState<SearchAnalytics | null>(null);
    const [searchSuggestions, setSearchSuggestions] = useState<string[]>([]);

    const searchService = new SearchService();

    useEffect(() => {
        // Load initial data
        setSearchHistory(searchService.getSearchHistory());
        setSavedSearches(searchService.getSavedSearches());
        setAnalytics(searchService.getSearchAnalytics());
    }, []);

    const handleSearch = async () => {
        if (!query.query.trim()) return;

        setLoading(true);
        try {
            const searchResults = await searchService.search(query, data);
            setResults(searchResults);
            setSearchSuggestions(searchService.getSearchSuggestions(query.query));
            onSearchComplete?.(searchResults);
            
            // Update query with results
            setQuery(prev => ({ ...prev, results: searchResults, timestamp: new Date() }));
        } catch (error) {
            console.error('Search failed:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (value: string) => {
        const newQuery = { ...query, query: value };
        setQuery(newQuery);
        
        // Generate suggestions as user types
        if (value.length > 2) {
            setSearchSuggestions(searchService.getSearchSuggestions(value));
        } else {
            setSearchSuggestions([]);
        }
    };

    const handleFilterChange = (filters: Partial<SearchFilters>) => {
        setQuery(prev => ({ ...prev, filters: { ...prev.filters, ...filters } }));
    };

    const saveSearch = () => {
        if (query.query.trim()) {
            const saved = searchService.saveSearch('My Search', query);
            setSavedSearches(prev => [saved, ...prev]);
        }
    };

    const deleteSavedSearch = (searchId: string) => {
        searchService.deleteSavedSearch(searchId);
        setSavedSearches(prev => prev.filter(s => s.id !== searchId));
    };

    const clearSearch = () => {
        setQuery({ 
            id: Date.now().toString(),
            query: '',
            type: 'text',
            filters: SearchService.getDefaultFilters()
        });
        setResults([]);
        setSearchSuggestions([]);
    };

    const getFilterCount = () => {
        let count = 0;
        const filters = query.filters;
        if (filters.dateRange) count++;
        if (filters.assetTypes?.length) count++;
        if (filters.sectors?.length) count++;
        if (filters.countries?.length) count++;
        if (filters.priceRange) count++;
        if (filters.performance) count++;
        if (Object.keys(filters.customFilters || {}).length > 0) count++;
        return count;
    };

    const formatDate = (date: Date) => {
        return date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        });
    };

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('en-US', { 
            style: 'currency', 
            currency: 'USD', 
            maximumFractionDigits: 2 
        }).format(val);
    };

    return (
        <div className="h-full flex flex-col bg-[#121212] text-white">
            {/* Search Header */}
            <div className="flex-none p-4 border-b border-gray-800">
                <div className="flex gap-3 flex-1 max-w-2xl">
                    <div className="relative flex-1">
                        <Search 
                            className="w-full"
                            placeholder="Search trades, positions, dividends, fees..."
                            value={query.query}
                            onChange={(e) => handleInputChange(e.target.value)}
                            onSearch={handleSearch}
                        />
                        {searchSuggestions.length > 0 && (
                            <div className="absolute top-full mt-2 bg-[#1a1a1a] border border-gray-700 rounded-lg shadow-xl z-50">
                                {searchSuggestions.slice(0, 5).map((suggestion, index) => (
                                    <div
                                        key={index}
                                        className="px-4 py-2 hover:bg-gray-700 cursor-pointer rounded"
                                        onClick={() => handleInputChange(suggestion)}
                                    >
                                        {suggestion}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`p-2 bg-gray-800 hover:bg-gray-700 rounded flex items-center gap-2 ${
                                showFilters ? 'bg-blue-600' : ''
                            }`}
                            title="Advanced Filters"
                        >
                            <Filter size={16} />
                            Filters
                            {getFilterCount() > 0 && (
                                <span className="bg-blue-500 text-white text-xs rounded-full px-2 py-1 ml-1">
                                    {getFilterCount()}
                                </span>
                            )}
                        </button>
                        
                        <button
                            onClick={() => setShowSaved(!showSaved)}
                            className={`p-2 bg-gray-800 hover:bg-gray-700 rounded flex items-center gap-2 ${
                                showSaved ? 'bg-blue-600' : ''
                            }`}
                            title="Saved Searches"
                        >
                            <Clock size={16} />
                            Saved
                        </button>
                    </div>
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={saveSearch}
                        disabled={!query.query.trim()}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded font-medium flex items-center gap-2"
                    >
                        <Save size={16} />
                        Save Search
                    </button>

                    <button
                        onClick={clearSearch}
                        className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded font-medium flex items-center gap-2"
                    >
                        <X size={16} />
                        Clear
                    </button>
                </div>
            </div>

            {/* Search Results */}
            <div className="flex-1 overflow-auto">
                {loading && (
                    <div className="flex justify-center items-center py-8">
                        <div className="text-gray-400">Searching...</div>
                    </div>
                )}

                {results.length === 0 && !loading && query.query && (
                    <div className="text-center py-8 text-gray-500">
                        <Search size={48} className="mx-auto mb-4 opacity-50" />
                        <p className="text-lg mb-2">No results found</p>
                        <p className="text-sm">Try different keywords or check your spelling</p>
                    </div>
                )}

                {results.length > 0 && (
                    <div className="p-4">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold">
                                Search Results ({results.length})
                            </h3>
                            {analytics && (
                                <button
                                    onClick={() => setShowAnalytics(!showAnalytics)}
                                    className="p-2 bg-gray-800 hover:bg-gray-700 rounded text-gray-300 flex items-center gap-2"
                                >
                                    <BarChart3 size={16} />
                                    Analytics
                                </button>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {results.map((result, index) => (
                                <div
                                    key={result.id}
                                    className="bg-gray-900 rounded-lg p-4 border border-gray-800 hover:border-blue-500 hover:bg-gray-800 cursor-pointer transition-all"
                                    onClick={() => {
                                        // Handle result click
                                        console.log('Search result clicked:', result);
                                    }}
                                >
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className={`w-8 h-8 rounded-full ${
                                                    result.type === 'trade' ? 'bg-blue-500/20' :
                                                    result.type === 'position' ? 'bg-green-500/20' :
                                                    result.type === 'dividend' ? 'bg-yellow-500/20' :
                                                    result.type === 'fee' ? 'bg-red-500/20' :
                                                    'bg-gray-500/20'
                                                }`}>
                                                    {
                                                        result.type === 'trade' ? <TrendingUp className="text-blue-400" size={16} /> :
                                                        result.type === 'position' ? <Star className="text-green-400" size={16} /> :
                                                        result.type === 'dividend' ? <Calendar className="text-yellow-400" size={16} /> :
                                                        result.type === 'fee' ? <X className="text-red-400" size={16} /> :
                                                        <Search className="text-gray-400" size={16} />
                                                    }
                                                </div>
                                                <span className="text-sm font-medium">{result.type}</span>
                                            </div>
                                            <h4 className="font-semibold text-white mb-1">{result.title}</h4>
                                            <p className="text-gray-300 text-sm mb-2">{result.description}</p>
                                            
                                            {result.data && (
                                                <div className="text-xs text-gray-500 space-y-1">
                                                    {result.type === 'trade' && (
                                                        <div>
                                                            <span>Date: {formatDate(result.data.date)}</span>
                                                            <span>Method: {result.data.method}</span>
                                                            <span>Price: {formatCurrency(result.data.sell_price)}</span>
                                                            <span>Quantity: {result.data.quantity}</span>
                                                        </div>
                                                    )}
                                                    
                                                    {result.type === 'position' && (
                                                        <div>
                                                            <span>Quantity: {result.data.totalQuantity}</span>
                                                            <span>Avg Cost: {formatCurrency(result.data.avgCost)}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            
                                            <div className="flex items-center gap-4 text-xs text-gray-500">
                                                <span>Score: {result.relevanceScore.toFixed(1)}</span>
                                                <span>{formatDate(result.timestamp)}</span>
                                            </div>
                                        </div>
                                        
                                        {result.type === 'trade' && (
                                            <button
                                                onClick={() => {
                                                    // Handle trade action
                                                    console.log('Trade action for:', result.data);
                                                }}
                                                className="p-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm"
                                            >
                                                View Details
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Advanced Filters Panel */}
            {showFilters && (
                <AdvancedFiltersPanel
                    filters={query.filters}
                    onFilterChange={handleFilterChange}
                    onClose={() => setShowFilters(false)}
                />
            )}

            {/* Saved Searches Panel */}
            {showSaved && (
                <SavedSearchesPanel
                    savedSearches={savedSearches}
                    onSelect={handleInputChange}
                    onDelete={deleteSavedSearch}
                    onClose={() => setShowSaved(false)}
                />
            )}

            {/* Analytics Panel */}
            {showAnalytics && analytics && (
                <SearchAnalyticsPanel
                    analytics={analytics}
                    onClose={() => setShowAnalytics(false)}
                />
            )}
        </div>
    );
};

// Advanced Filters Panel Component
const AdvancedFiltersPanel: React.FC<{
    filters: SearchFilters;
    onFilterChange: (filters: Partial<SearchFilters>) => void;
    onClose: () => void;
}> = ({ filters, onFilterChange, onClose }) => {
    const [localFilters, setLocalFilters] = useState(filters);

    const handleDateChange = (field: 'start' | 'end', value: string) => {
        setLocalFilters(prev => ({
            ...prev,
            dateRange: {
                ...prev.dateRange,
                [field]: new Date(value)
            }
        }));
    };

    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
            <div className="bg-[#1a1a1a] border border-gray-700 rounded-lg max-w-4xl w-full max-h-[80vh] shadow-2xl">
                <div className="flex justify-between items-center p-6 border-b border-gray-700">
                    <h2 className="text-xl font-bold">Advanced Search Filters</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Date Range */}
                    <div>
                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            <Calendar size={20} />
                            Date Range
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">Start Date</label>
                                <input
                                    type="date"
                                    value={localFilters.dateRange?.start?.toISOString().split('T')[0]}
                                    onChange={(e) => handleDateChange('start', e.target.value)}
                                    className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">End Date</label>
                                <input
                                    type="date"
                                    value={localFilters.dateRange?.end?.toISOString().split('T')[0]}
                                    onChange={(e) => handleDateChange('end', e.target.value)}
                                    className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Asset Types */}
                    <div>
                        <h3 className="text-lg font-semibold mb-4">Asset Types</h3>
                        <div className="space-y-2">
                            {['trade', 'position', 'dividend', 'fee'].map(type => (
                                <label key={type} className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={localFilters.assetTypes?.includes(type) || false}
                                        onChange={(e) => setLocalFilters(prev => ({
                                            ...prev,
                                            assetTypes: e.target.checked 
                                                ? [...(prev.assetTypes || []), type]
                                                : (prev.assetTypes || []).filter(t => t !== type)
                                        }))}
                                        className="w-4 h-4"
                                    />
                                    <span className="text-gray-300">{type.charAt(0).toUpperCase() + type.slice(1)}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Sectors */}
                    <div>
                        <h3 className="text-lg font-semibold mb-4">Sectors</h3>
                        <div className="space-y-2">
                            {['Technology', 'Healthcare', 'Finance', 'Energy', 'Consumer', 'Industrial'].map(sector => (
                                <label key={sector} className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={localFilters.sectors?.includes(sector) || false}
                                        onChange={(e) => setLocalFilters(prev => ({
                                            ...prev,
                                            sectors: e.target.checked 
                                                ? [...(prev.sectors || []), sector]
                                                : (prev.sectors || []).filter(s => s !== sector)
                                        }))}
                                        className="w-4 h-4"
                                    />
                                    <span className="text-gray-300">{sector}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Price Range */}
                    <div>
                        <h3 className="text-lg font-semibold mb-4">Price Range</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">Minimum Price</label>
                                <input
                                    type="number"
                                    value={localFilters.priceRange?.min || ''}
                                    onChange={(e) => setLocalFilters(prev => ({
                                            ...prev,
                                            priceRange: {
                                                ...prev.priceRange,
                                                min: parseFloat(e.target.value)
                                            }
                                        }))}
                                    className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">Maximum Price</label>
                                <input
                                    type="number"
                                    value={localFilters.priceRange?.max || ''}
                                    onChange={(e) => setLocalFilters(prev => ({
                                            ...prev,
                                            priceRange: {
                                                ...prev.priceRange,
                                                max: parseFloat(e.target.value)
                                            }
                                        }))}
                                    className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Performance Filters */}
                    <div>
                        <h3 className="text-lg font-semibold mb-4">Performance Filters</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">Min Return (%)</label>
                                <input
                                    type="number"
                                    value={localFilters.performance?.minReturn || ''}
                                    onChange={(e) => setLocalFilters(prev => ({
                                            ...prev,
                                            performance: {
                                                ...prev.performance,
                                                minReturn: parseFloat(e.target.value)
                                            }
                                        }))}
                                    className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">Max Return (%)</label>
                                <input
                                    type="number"
                                    value={localFilters.performance?.maxReturn || ''}
                                    onChange={(e) => setLocalFilters(prev => ({
                                            ...prev,
                                            performance: {
                                                ...prev.performance,
                                                maxReturn: parseFloat(e.target.value)
                                            }
                                        }))}
                                    className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-700">
                        <button
                            onClick={() => {
                                setLocalFilters(SearchService.getDefaultFilters());
                                onFilterChange(SearchService.getDefaultFilters());
                            }}
                            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg font-medium"
                        >
                            Reset to Default
                        </button>
                        <button
                            onClick={() => {
                                onFilterChange(localFilters);
                                onClose();
                            }}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium"
                        >
                            Apply Filters
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Saved Searches Panel Component
const SavedSearchesPanel: React.FC<{
    savedSearches: SavedSearch[];
    onSelect: (query: SearchQuery) => void;
    onDelete: (searchId: string) => void;
    onClose: () => void;
}> = ({ savedSearches, onSelect, onDelete, onClose }) => {
    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
            <div className="bg-[#1a1a1a] border border-gray-700 rounded-lg max-w-4xl w-full max-h-[80vh] shadow-2xl">
                <div className="flex justify-between items-center p-6 border-b border-gray-700">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <Clock size={24} />
                        Saved Searches
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6">
                    {savedSearches.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            <Clock size={48} className="mx-auto mb-4 opacity-50" />
                            <p className="text-lg mb-2">No saved searches</p>
                            <p className="text-sm">Save your frequently used searches for quick access.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {savedSearches.map((saved, index) => (
                                <div
                                    key={saved.id}
                                    className="flex items-center justify-between p-4 bg-gray-900 rounded-lg border border-gray-800 hover:bg-gray-800"
                                >
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3">
                                            {saved.pinned && (
                                                <Star className="text-yellow-400" size={16} />
                                            )}
                                            <div>
                                                <h4 className="font-semibold text-white">{saved.name}</h4>
                                                <p className="text-sm text-gray-400 mb-2">{saved.query.query}</p>
                                                <div className="flex items-center gap-4 text-xs text-gray-500">
                                                    <span>Created: {saved.timestamp.toLocaleDateString()}</span>
                                                    <span>Used: {saved.useCount} times</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-2">
                                        <button
                                                onClick={() => onSelect(saved.query)}
                                                className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm"
                                        >
                                                <RefreshCw size={16} />
                                                Search
                                        </button>
                                        
                                        <button
                                                onClick={() => onDelete(saved.id)}
                                                className="p-2 bg-red-600 hover:bg-red-500 text-red-300 rounded text-sm"
                                        >
                                                <Trash2 size={16} />
                                                Delete
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

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

// Search Analytics Panel Component
const SearchAnalyticsPanel: React.FC<{
    analytics: SearchAnalytics;
    onClose: () => void;
}> = ({ analytics, onClose }) => {
    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
            <div className="bg-[#1a1a1a] border border-gray-700 rounded-lg max-w-4xl w-full max-h-[80vh] shadow-2xl">
                <div className="flex justify-between items-center p-6 border-b border-gray-700">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <BarChart3 size={24} />
                        Search Analytics
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
                            <h3 className="text-lg font-semibold text-white mb-2">Search Statistics</h3>
                            <div className="space-y-2">
                                <div className="flex justify-between">
                                    <span className="text-gray-400">Total Searches</span>
                                    <span className="text-2xl font-bold text-white">{analytics.totalSearches}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-400">Average Results</span>
                                    <span className="text-2xl font-bold text-white">{analytics.averageResultCount.toFixed(1)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-400">Success Rate</span>
                                    <span className="text-2xl font-bold text-green-400">{(analytics.searchSuccessRate * 100).toFixed(1)}%</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
                            <h3 className="text-lg font-semibold text-white mb-2">Popular Queries</h3>
                            <div className="space-y-2">
                                {analytics.popularQueries.slice(0, 10).map((query, index) => (
                                    <div key={index} className="flex justify-between items-center">
                                        <span className="text-gray-300">{index + 1}. {query.query}</span>
                                        <span className="text-blue-400 font-semibold">{query.count} searches</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
                            <h3 className="text-lg font-semibold text-white mb-2">Search Trends</h3>
                            <div className="space-y-2">
                                {analytics.searchTrends.slice(0, 10).map((trend, index) => (
                                    <div key={index} className="flex items-center gap-2">
                                        <span className="text-gray-400">{trend.term}</span>
                                        <div className="flex items-center gap-2">
                                            <TrendingUp className="text-green-400" size={14} />
                                            <span className="text-gray-300">Frequency: {trend.frequency}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

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