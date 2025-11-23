import { put, del, type PutBlobResult } from '@vercel/blob';
import { config } from '../config.js';
import ExcelJS from 'exceljs';

/**
 * BlobStorageService - Unified file storage service for Vercel Blob Storage
 * 
 * This service abstracts all blob storage operations, providing a clean API
 * for uploading, downloading, and managing files in Vercel Blob Storage.
 * 
 * Features:
 * - Upload files with automatic content type detection
 * - Download files as buffers for processing
 * - Delete files from blob storage
 * - Helper functions for ExcelJS integration
 * - URL validation and conversion utilities
 */
export class BlobStorageService {
  private token: string | undefined;

  constructor() {
    this.token = config.BLOB_READ_WRITE_TOKEN;
    
    if (!this.token && process.env.NODE_ENV === 'production') {
      console.warn('BLOB_READ_WRITE_TOKEN not set. Blob storage operations will fail.');
    }
  }

  /**
   * Check if a given path/URL is a Vercel Blob URL
   * @param path - File path or URL to check
   * @returns true if the path is a blob URL, false otherwise
   */
  isBlobUrl(path: string): boolean {
    if (!path) return false;
    
    // Check for Vercel Blob URL patterns
    // Examples:
    // - https://[project].public.blob.vercel-storage.com/...
    // - https://blob.vercel-storage.com/...
    return (
      typeof path === 'string' &&
      path.startsWith('https://') &&
      (path.includes('blob.vercel-storage.com') || 
       path.includes('public.blob.vercel-storage.com'))
    );
  }

  /**
   * Get the public download URL for a blob
   * If the URL is already a blob URL, return it as-is
   * @param blobUrl - Blob URL
   * @returns Public download URL
   */
  getFileUrl(blobUrl: string): string {
    if (!this.isBlobUrl(blobUrl)) {
      throw new Error(`Invalid blob URL: ${blobUrl}`);
    }
    return blobUrl;
  }

  /**
   * Upload a file to Vercel Blob Storage
   * 
   * @param buffer - File content as Buffer
   * @param key - Blob key/path (e.g., 'uploads/ship-a/template_123.xlsx')
   * @param contentType - MIME type of the file
   * @param addRandomSuffix - Whether to add a random suffix to prevent overwrites (default: true)
   * @returns Object with blob URL and pathname
   */
  async uploadFile(
    buffer: Buffer,
    key: string,
    contentType: string = 'application/octet-stream',
    addRandomSuffix: boolean = true
  ): Promise<{ url: string; pathname: string }> {
    if (!this.token) {
      throw new Error('BLOB_READ_WRITE_TOKEN is not configured. Cannot upload file.');
    }

    try {
      const blob: PutBlobResult = await put(key, buffer, {
        access: 'public',
        contentType,
        token: this.token,
        addRandomSuffix,
      });

      console.log(`✓ BlobStorage: Uploaded file to ${blob.url}`);
      
      return {
        url: blob.url,
        pathname: blob.pathname,
      };
    } catch (error) {
      console.error('BlobStorage: Upload failed:', error);
      throw new Error(`Failed to upload file to blob storage: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Download a file from Vercel Blob Storage
   * 
   * @param blobUrl - Blob URL to download
   * @returns File content as Buffer
   */
  async downloadFile(blobUrl: string): Promise<Buffer> {
    if (!this.isBlobUrl(blobUrl)) {
      throw new Error(`Invalid blob URL: ${blobUrl}`);
    }

    try {
      const response = await fetch(blobUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch blob content: ${response.status} ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      console.log(`✓ BlobStorage: Downloaded file from ${blobUrl} (${buffer.length} bytes)`);
      
      return buffer;
    } catch (error) {
      console.error('BlobStorage: Download failed:', error);
      throw new Error(`Failed to download file from blob storage: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete a file from Vercel Blob Storage
   * 
   * @param blobUrl - Blob URL to delete
   */
  async deleteFile(blobUrl: string): Promise<void> {
    if (!this.isBlobUrl(blobUrl)) {
      throw new Error(`Invalid blob URL: ${blobUrl}`);
    }

    if (!this.token) {
      throw new Error('BLOB_READ_WRITE_TOKEN is not configured. Cannot delete file.');
    }

    try {
      await del(blobUrl, {
        token: this.token,
      });

      console.log(`✓ BlobStorage: Deleted file ${blobUrl}`);
    } catch (error) {
      console.error('BlobStorage: Delete failed:', error);
      throw new Error(`Failed to delete file from blob storage: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ============================================================================
  // ExcelJS Integration Helpers
  // ============================================================================

  /**
   * Load an Excel workbook from Blob Storage
   * Downloads the blob, then loads it into an ExcelJS Workbook
   * 
   * @param blobUrl - Blob URL of the Excel file
   * @returns ExcelJS Workbook instance
   */
  async loadWorkbookFromBlob(blobUrl: string): Promise<ExcelJS.Workbook> {
    const buffer = await this.downloadFile(blobUrl);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    
    console.log(`✓ BlobStorage: Loaded workbook from ${blobUrl}`);
    
    return workbook;
  }

  /**
   * Save an Excel workbook to Blob Storage
   * Writes the workbook to a buffer, then uploads to Blob Storage
   * 
   * @param workbook - ExcelJS Workbook instance
   * @param key - Blob key/path (e.g., 'output/ship-a/pax_1234567890.xlsx')
   * @param addRandomSuffix - Whether to add random suffix (default: true)
   * @returns Blob URL of the uploaded file
   */
  async saveWorkbookToBlob(
    workbook: ExcelJS.Workbook,
    key: string,
    addRandomSuffix: boolean = true
  ): Promise<string> {
    const buffer = await workbook.xlsx.writeBuffer();
    const contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    
    const { url } = await this.uploadFile(buffer, key, contentType, addRandomSuffix);
    
    console.log(`✓ BlobStorage: Saved workbook to ${url}`);
    
    return url;
  }

  /**
   * Load an Excel file from Blob Storage using XLSX library
   * Alternative to ExcelJS for simple read operations
   * 
   * @param blobUrl - Blob URL of the Excel file
   * @returns Buffer containing the file data
   */
  async loadFileBufferFromBlob(blobUrl: string): Promise<Buffer> {
    return await this.downloadFile(blobUrl);
  }
}

// Export a singleton instance for use throughout the application
export const blobStorage = new BlobStorageService();


