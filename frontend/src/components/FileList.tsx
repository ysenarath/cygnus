import React, { useEffect, useState, useMemo } from 'react';
import { FileModel } from '../types/file';

interface FileListProps {
    onFileDeleted?: () => void;
}

export function FileList({ onFileDeleted }: FileListProps) {
    const [files, setFiles] = useState<FileModel[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const filteredFiles = useMemo(() => {
        if (!searchQuery) return files;
        const query = searchQuery.toLowerCase();
        return files.filter(file => 
            file.original_filename.toLowerCase().includes(query)
        );
    }, [files, searchQuery]);

    const fetchFiles = async () => {
        try {
            const response = await fetch('http://localhost:8000/api/files/list');
            if (!response.ok) {
                throw new Error('Failed to fetch files');
            }
            const data = await response.json();
            setFiles(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch files');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchFiles();
    }, []);

    const handleDownload = async (fileId: number) => {
        window.open(`http://localhost:8000/api/files/download/${fileId}`);
    };

    const handleDelete = async (fileId: number) => {
        try {
            const response = await fetch(`http://localhost:8000/api/files/${fileId}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                throw new Error('Failed to delete file');
            }

            setFiles(files.filter(f => f.id !== fileId));
            onFileDeleted?.();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete file');
        }
    };

    const formatFileSize = (bytes: number): string => {
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = bytes;
        let unitIndex = 0;

        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }

        return `${size.toFixed(1)} ${units[unitIndex]}`;
    };

    if (loading) {
        return <div className="text-center py-4">Loading...</div>;
    }

    if (error) {
        return (
            <div className="text-center py-4 text-red-600">
                Error: {error}
            </div>
        );
    }

    if (files.length === 0) {
        return (
            <div className="text-center py-8 text-gray-500">
                No files uploaded yet
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <input
                    type="text"
                    placeholder="Search files..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>

            <div className="space-y-4">
              {filteredFiles.map(file => (
                <div
                    key={file.id}
                    className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex items-center justify-between"
                >
                    <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-medium text-gray-900 truncate">
                            {file.original_filename}
                        </h3>
                        <div className="mt-1 flex items-center text-sm text-gray-500 space-x-4">
                            <span>{formatFileSize(file.size)}</span>
                            <span>•</span>
                            <span>{new Date(file.uploaded_at).toLocaleDateString()}</span>
                        </div>
                        {file.description && (
                            <p className="mt-1 text-sm text-gray-500 truncate">
                                {file.description}
                            </p>
                        )}
                    </div>
                    <div className="ml-4 flex items-center space-x-2">
                        <button
                            onClick={() => handleDownload(file.id)}
                            className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800"
                        >
                            Download
                        </button>
                        <button
                            onClick={() => handleDelete(file.id)}
                            className="px-3 py-1 text-sm text-red-600 hover:text-red-800"
                        >
                            Delete
                        </button>
                    </div>
                </div>
              ))}
            </div>
          </div>
        );
}
