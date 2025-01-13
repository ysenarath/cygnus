import { Link } from 'react-router-dom';

export function Home() {
    return (
        <div className="min-h-screen bg-gray-100">
            <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                <div className="px-4 py-6 sm:px-0">
                    <div className="border-4 border-dashed border-gray-200 rounded-lg p-4 min-h-[400px] bg-gradient-to-b from-gray-50 to-gray-100">
                        <h1 className="text-2xl font-bold text-gray-900 mb-4">Welcome to Cygnus</h1>
                        <p className="text-gray-600 mb-8">A modern file management system</p>
                        <Link
                            to="/files"
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                            Go to Files
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
