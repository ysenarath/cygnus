import React, { useState } from "react";
import { Link } from "react-router-dom";
import authService from "../services/authService";
import searchService from "../services/searchService";
import ThemeToggle from "./ThemeToggle";

function Search({ user, onLogout }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    
    if (!query.trim()) {
      setError("Please enter a search query");
      return;
    }

    setIsSearching(true);
    setError("");
    setHasSearched(true);

    try {
      const data = await searchService.searchDocuments(query, 20);
      setResults(data.results || []);
    } catch (err) {
      setError(err.message || "Search failed");
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleLogout = async () => {
    await authService.logout();
    onLogout();
  };

  const formatDistance = (distance) => {
    if (distance === null || distance === undefined) return "";
    const similarity = (1 - distance) * 100;
    return similarity.toFixed(1);
  };

  return (
    <div className="h-screen flex flex-col bg-light-bg dark:bg-dark-bg">
      {/* Header */}
      <nav className="bg-light-surface dark:bg-dark-surface border-b border-light-border dark:border-dark-border">
        <div className="px-4 h-14 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-lg font-semibold text-light-text dark:text-dark-text">
              Cygnus Search
            </h1>
          </div>

          <div className="flex items-center space-x-4">
            <Link
              to="/files"
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
            >
              File Manager
            </Link>
            
            <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-light-bg dark:bg-dark-bg">
              <div className="w-7 h-7 bg-gradient-to-br from-light-primary to-light-primary-hover dark:from-dark-primary dark:to-dark-primary-hover rounded-full flex items-center justify-center">
                <svg
                  className="w-4 h-4 text-white"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <span className="text-sm font-medium text-light-text dark:text-dark-text">
                {user.username}
              </span>
            </div>

            <ThemeToggle />

            <button
              onClick={handleLogout}
              className="px-3 py-1.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      {/* Search Container */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto">
          <div className="max-w-3xl mx-auto px-4 pt-16">
            {/* Search Form */}
            <form onSubmit={handleSearch} className="mb-8">
              <div className="relative">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search documents..."
                  className="w-full px-6 py-4 text-lg border-2 border-light-border dark:border-dark-border rounded-full shadow-lg focus:outline-none focus:border-light-primary dark:focus:border-dark-primary bg-light-surface dark:bg-dark-surface text-light-text dark:text-dark-text transition-colors"
                  disabled={isSearching}
                />
                <button
                  type="submit"
                  disabled={isSearching}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 px-6 py-2 bg-light-primary hover:bg-light-primary-hover disabled:opacity-50 text-white dark:text-black rounded-full transition-colors"
                >
                  {isSearching ? (
                    <span className="flex items-center">
                      <svg className="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Searching...
                    </span>
                  ) : (
                    "Search"
                  )}
                </button>
              </div>
            </form>

            {/* Error Message */}
            {error && (
              <div className="mb-6 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <svg
                    className="w-5 h-5 text-red-500"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="text-sm text-red-700 dark:text-red-400">
                    {error}
                  </span>
                </div>
                <button
                  onClick={() => setError(null)}
                  className="text-red-500 hover:text-red-700 dark:hover:text-red-300"
                >
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </div>
            )}

            {/* Results */}
            {hasSearched && (
              <div className="space-y-4 pb-8">
                {results.length > 0 ? (
                  <>
                    <div className="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-4">
                      About {results.length} results
                    </div>
                    {results.map((result, index) => (
                      <div
                        key={index}
                        className="p-6 bg-light-surface dark:bg-dark-surface rounded-lg shadow hover:shadow-md transition-shadow border border-light-border dark:border-dark-border"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="text-lg font-medium text-light-primary dark:text-dark-primary">
                            {result.metadata?.filename || "Untitled"}
                          </h3>
                          {result.distance !== null && (
                            <span className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded">
                              {formatDistance(result.distance)}% match
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-3">
                          Chunk {result.metadata?.chunk_index + 1} of {result.metadata?.total_chunks}
                          {result.metadata?.upload_date && (
                            <span className="ml-2">
                              • {new Date(result.metadata.upload_date).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        <p className="text-light-text dark:text-dark-text leading-relaxed">
                          {result.document}
                        </p>
                      </div>
                    ))}
                  </>
                ) : (
                  !isSearching && (
                    <div className="text-center py-12 text-light-text-secondary dark:text-dark-text-secondary">
                      <svg
                        className="mx-auto h-12 w-12 mb-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <p className="text-lg">No results found</p>
                      <p className="text-sm mt-2">Try different keywords or check if documents are indexed</p>
                    </div>
                  )
                )}
              </div>
            )}

            {/* Empty State */}
            {!hasSearched && !isSearching && (
              <div className="text-center py-12 text-light-text-secondary dark:text-dark-text-secondary">
                <svg
                  className="mx-auto h-16 w-16 mb-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <p className="text-lg">Search across your documents</p>
                <p className="text-sm mt-2">Enter keywords to find relevant content</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Search;
