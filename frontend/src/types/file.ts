export interface FileModel {
    id: number;
    filename: string;
    original_filename: string;
    content_type: string;
    size: number;
    uploaded_at: string;
    description: string | null;
}

export interface FileUploadResponse extends FileModel { }

export interface FileListResponse {
    files: FileModel[];
}
