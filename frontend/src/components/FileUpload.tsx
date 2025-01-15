import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { FileModel } from '../types/file';

interface FileUploadProps {
    onUploadComplete?: (file: FileModel) => void;
}

export function FileUpload({ onUploadComplete }: FileUploadProps) {
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        const file = acceptedFiles[0];
        if (!file) return;

        setUploading(true);
        setError(null);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch('http://localhost:8000/api/files/upload', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error('Upload failed');
            }

            const data: FileModel = await response.json();
            onUploadComplete?.(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Upload failed');
        } finally {
            setUploading(false);
        }
    }, [onUploadComplete]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        multiple: false
    });

    return (
        <div className="w-full max-w-xl mx-auto">
            <div
                {...getRootProps()}
                className={`
                    border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
                    transition-colors duration-200 ease-in-out
                    ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
                `}
            >
                <input {...getInputProps()} />
                {uploading ? (
                    <p className="text-gray-600">Uploading...</p>
                ) : isDragActive ? (
                    <p className="text-blue-500">Drop the file here</p>
                ) : (
                    <div>
                        <p className="text-gray-600">Drag and drop a file here, or click to select</p>
                        <p className="text-sm text-gray-500 mt-2">Any file type accepted</p>
                    </div>
                )}
            </div>
            {error && (
                <div className="mt-4 p-3 bg-red-100 text-red-700 rounded">
                    {error}
                </div>
            )}
        </div>
    );
}
