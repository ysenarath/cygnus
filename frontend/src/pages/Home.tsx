import { Link } from 'react-router-dom';
import { useState } from 'react';

interface SearchQuery {
    query: string;
    error: string | null;
    results: string[];
}

export function Home() {
    const [searchQuery, setSearchQuery] = useState<SearchQuery | null>(null);

    const handleSearch = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        const searchInput = document.getElementById('file-search-input') as HTMLInputElement;
        const searchQuery = searchInput.value;
        if (searchQuery) {
            setSearchQuery({ query: searchQuery, error: null, results: [] });
        }
        else {
            setSearchQuery({ query: searchQuery, error: 'Search query cannot be empty', results: [] });
        }
    }

    return (
        <div className="min-h-screen bg-gray-100">
            <div className="max-w-7xl mx-auto sm:px-6 lg:px-8">
                <div className="p-4 sm:px-0">
                    <div className="border-4 border-dashed border-gray-200 rounded-lg p-4 bg-gradient-to-b from-gray-50 to-gray-100">
                        <h1 className="text-2xl font-bold text-gray-900 mb-4">Welcome to Cygnus</h1>
                        <p className="text-gray-600">A modern file management system</p>
                    </div>
                    <div className="border-4 border-dashed border-gray-200 rounded-lg p-4 bg-gradient-to-b from-gray-50 to-gray-100 mt-4">
                        <form className="flex items-center">
                            <input
                                id="file-search-input"
                                type="text"
                                placeholder="Search files..."
                                className="flex-grow px-4 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <button
                                id="file-search-button"
                                type="submit"
                                className="px-4 py-2 border border-transparent text-sm font-medium rounded-r-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                onClick={handleSearch}
                            >
                                Search
                            </button>
                            <Link
                                to="/files"
                                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ms-4"
                            >
                                Manage Files
                            </Link>
                        </form>
                    </div>
                    <div className="border-4 border-dashed border-gray-200 rounded-lg p-4 bg-gradient-to-b from-gray-50 to-gray-100 mt-4">
                        {searchQuery?.error && (
                            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                                Error: {searchQuery.error}
                            </div>
                        )}
                        {searchQuery?.error === null && (
                            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
                                <p>Search query: {searchQuery.query}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
