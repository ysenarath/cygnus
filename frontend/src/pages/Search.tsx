import { useState } from 'react';

interface SearchResult {
  text: string;
  score: number;
  document_id: number;
  position: number;
}

interface SearchState {
  query: string;
  results: SearchResult[];
  error: string | null;
  loading: boolean;
}

const ITEMS_PER_PAGE = 10;

export function Search() {
  const [searchState, setSearchState] = useState<SearchState>({
    query: '',
    results: [],
    error: null,
    loading: false
  });
  const [currentPage, setCurrentPage] = useState(1);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchState.query.trim()) {
      setSearchState(prev => ({ ...prev, error: 'Search query cannot be empty' }));
      return;
    }

    setSearchState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const response = await fetch(`/api/files/search?query=${encodeURIComponent(searchState.query)}&k=50`);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Search failed');
      }
      const text = await response.text();
      const results = text ? JSON.parse(text) : [];
      setSearchState(prev => ({ ...prev, results, loading: false }));
      setCurrentPage(1);
    } catch (error) {
      setSearchState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'An error occurred',
        loading: false
      }));
    }
  };

  // Calculate pagination
  const totalPages = Math.ceil(searchState.results.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedResults = searchState.results.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Search Documents</h1>
      
      <form onSubmit={handleSearch} className="mb-8">
        <div className="flex gap-2">
          <input
            type="text"
            value={searchState.query}
            onChange={(e) => setSearchState(prev => ({ ...prev, query: e.target.value }))}
            placeholder="Enter your search query..."
            className="flex-grow px-4 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={searchState.loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-r-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-400"
          >
            {searchState.loading ? 'Searching...' : 'Search'}
          </button>
        </div>
      </form>

      {searchState.error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {searchState.error}
        </div>
      )}

      {searchState.results.length > 0 && (
        <div>
          <div className="bg-white shadow-md rounded-lg overflow-hidden">
            {paginatedResults.map((result, index) => (
              <div
                key={`${result.document_id}-${result.position}`}
                className={`p-4 ${index < paginatedResults.length - 1 ? 'border-b' : ''}`}
              >
                <p className="text-gray-800">{result.text}</p>
                <div className="mt-2 text-sm text-gray-500">
                  Score: {result.score.toFixed(4)} | Document ID: {result.document_id}
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="mt-4 flex justify-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50"
              >
                Previous
              </button>
              <span className="px-3 py-1">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}

      {!searchState.loading && searchState.results.length === 0 && searchState.query && !searchState.error && (
        <div className="text-center text-gray-600 mt-8">
          No results found
        </div>
      )}
    </div>
  );
}
