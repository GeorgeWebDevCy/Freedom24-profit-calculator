import React, { useEffect, useMemo, useState } from 'react';
import { Search as SearchIcon } from 'lucide-react';
import { CalculationResult, SearchFilters, SearchQuery, SearchResult } from '../../lib/types';
import { SearchService } from '../../lib/services/search.service';

interface SearchPanelProps {
    data: CalculationResult;
    onSearchComplete?: (results: SearchResult[]) => void;
}

type QueryType = 'text' | 'ticker' | 'advanced';

export const SearchPanel: React.FC<SearchPanelProps> = ({ data, onSearchComplete }) => {
    const searchService = useMemo(() => new SearchService(), []);

    const [queryText, setQueryText] = useState('');
    const [queryType, setQueryType] = useState<QueryType>('text');
    const [filters, setFilters] = useState<SearchFilters>(SearchService.getDefaultFilters());
    const [results, setResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        searchService.buildSearchIndex(data);
    }, [data, searchService]);

    const toggleAssetType = (assetType: string) => {
        const current = filters.assetTypes ?? [];
        const exists = current.includes(assetType);
        const next = exists ? current.filter((x) => x !== assetType) : [...current, assetType];
        setFilters((prev) => ({ ...prev, assetTypes: next }));
    };

    const runSearch = async () => {
        if (!queryText.trim()) {
            setResults([]);
            onSearchComplete?.([]);
            return;
        }

        setLoading(true);

        try {
            const query: SearchQuery = {
                id: `${Date.now()}`,
                query: queryText.trim(),
                type: queryType,
                filters,
                timestamp: new Date(),
                saved: false,
            };

            const found = await searchService.search(query, data);
            setResults(found);
            onSearchComplete?.(found);
        } catch (error) {
            console.error('Search failed', error);
            setResults([]);
            onSearchComplete?.([]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="h-full flex flex-col bg-[#121212] text-white">
            <div className="p-4 border-b border-gray-800 flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[260px]">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                    <input
                        value={queryText}
                        onChange={(event) => setQueryText(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') runSearch();
                        }}
                        placeholder="Search trades, positions, dividends, fees"
                        className="w-full bg-gray-900 border border-gray-700 rounded pl-9 pr-3 py-2 text-sm outline-none focus:border-blue-500"
                    />
                </div>

                <select
                    value={queryType}
                    onChange={(event) => setQueryType(event.target.value as QueryType)}
                    className="bg-gray-900 border border-gray-700 rounded px-2 py-2 text-sm text-white"
                >
                    <option value="text">Text</option>
                    <option value="ticker">Ticker</option>
                    <option value="advanced">Advanced</option>
                </select>

                <button
                    onClick={runSearch}
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white disabled:bg-gray-700 disabled:cursor-not-allowed rounded text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70"
                >
                    {loading ? 'Searching...' : 'Search'}
                </button>
            </div>

            <div className="px-4 py-3 border-b border-gray-800 flex flex-wrap items-center gap-2">
                <span className="text-xs uppercase text-gray-500 mr-2">Asset Types</span>
                {['trade', 'position', 'dividend', 'fee'].map((assetType) => {
                    const enabled = (filters.assetTypes ?? []).includes(assetType);
                    return (
                        <button
                            key={assetType}
                            onClick={() => toggleAssetType(assetType)}
                            className={`px-2 py-1 rounded text-xs border ${enabled
                                ? 'bg-blue-600/25 text-blue-200 border-blue-400/60'
                                : 'bg-gray-900 text-gray-200 border-gray-700 hover:bg-gray-800 hover:text-white'
                            }`}
                        >
                            {assetType}
                        </button>
                    );
                })}
            </div>

            <div className="flex-1 overflow-auto p-4">
                {!loading && results.length === 0 && queryText.trim() && (
                    <div className="text-sm text-gray-500">No results found.</div>
                )}

                {!queryText.trim() && (
                    <div className="text-sm text-gray-500">Enter a query to search portfolio data.</div>
                )}

                <div className="space-y-3">
                    {results.map((result) => (
                        <div key={result.id} className="bg-gray-900 border border-gray-800 rounded p-3">
                            <div className="flex justify-between gap-4">
                                <div>
                                    <div className="text-xs uppercase text-blue-400 mb-1">{result.type}</div>
                                    <div className="font-medium">{result.title}</div>
                                    <div className="text-sm text-gray-400 mt-1">{result.description}</div>
                                </div>
                                <div className="text-right text-xs text-gray-500">
                                    <div>Score: {result.relevanceScore.toFixed(1)}</div>
                                    <div>{new Date(result.timestamp).toLocaleDateString()}</div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
