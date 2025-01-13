import { FileUpload } from '../components/FileUpload';
import { FileList } from '../components/FileList';
import { FileModel } from '../types/file';
import { useState, useEffect } from 'react';

interface HealthStatus {
  status: string;
  database: string;
}

export function Files() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await fetch('http://localhost:8000/api/health');
        const data = await response.json();
        setHealth(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to check health status');
        setHealth(null);
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleUploadComplete = (file: FileModel) => {
    setRefreshKey(prev => prev + 1);
  };

  const handleFileDeleted = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="border-4 border-dashed border-gray-200 rounded-lg p-4 min-h-[800px] bg-gradient-to-b from-gray-50 to-gray-100">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Cygnus File Manager</h1>
            
            {error ? (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                Error: {error}
              </div>
            ) : health ? (
              <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
                <p>Status: {health.status}</p>
                <p>Database: {health.database}</p>
              </div>
            ) : (
              <div className="animate-pulse flex space-x-4 mb-4">
                <div className="flex-1 space-y-4 py-1">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-200 rounded"></div>
                </div>
              </div>
            )}

            <div className="space-y-8 h-full">
              <div>
                <h2 className="text-lg font-medium text-gray-900 mb-4">Upload Files</h2>
                <FileUpload onUploadComplete={handleUploadComplete} />
              </div>

              <div>
                <h2 className="text-lg font-medium text-gray-900 mb-4">Your Files</h2>
                <FileList key={refreshKey} onFileDeleted={handleFileDeleted} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
