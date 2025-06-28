export interface UploadedFile {
  id: number;
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
  uploadedAt: string;
}

export interface SheetPreview {
  name: string;
  rowCount: number;
  columns: string[];
  sampleData: Record<string, any>[];
}

export interface UploadResponse {
  file: UploadedFile;
  preview: {
    sheets: SheetPreview[];
  };
}

export interface ProcessingJob {
  id: number;
  fileId: number;
  templateType: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  resultFilePath?: string;
  dropboxExported: boolean;
  errorMessage?: string;
  createdAt: string;
  completedAt?: string;
}

export interface ProcessingHistoryItem {
  processingJobs: ProcessingJob;
  uploadedFiles: UploadedFile;
}
