import fs from "fs";
import path from "path";
import { format } from 'date-fns';

interface DropboxFileMetadata {
  filename: string;
  dropboxPath: string;
  sharedLink?: string;
  uploadedAt: Date;
  size: number;
  shipId: string;
  reportType: string;
}

interface BatchUploadResult {
  success: boolean;
  uploadedFiles: DropboxFileMetadata[];
  failedFiles: { filename: string; error: string }[];
  sharedFolderLink?: string;
}

export class DropboxService {
  private accessToken: string;
  private uploadMetadata: Map<string, DropboxFileMetadata> = new Map();

  constructor() {
    this.accessToken = process.env.DROPBOX_ACCESS_TOKEN || process.env.DROPBOX_TOKEN || "";
    
    if (!this.accessToken) {
      console.warn("Dropbox access token not configured. Export functionality will be limited.");
    }
  }

  async uploadFile(filePathOrUrl: string, dropboxPath: string): Promise<boolean> {
    if (!this.accessToken) {
      console.error("Dropbox access token not configured");
      return false;
    }

    try {
      let fileContent: Buffer;
      let sourceFilename: string;

      // Check if it's a blob URL
      if (blobStorage.isBlobUrl(filePathOrUrl)) {
        console.log(`→ DropboxService: Downloading file from blob storage: ${filePathOrUrl}`);
        fileContent = await blobStorage.downloadFile(filePathOrUrl);
        // Extract filename from blob URL or use a default
        sourceFilename = path.basename(filePathOrUrl.split('?')[0]) || path.basename(dropboxPath);
        console.log(`→ DropboxService: Downloaded ${fileContent.length} bytes from blob storage`);
      } else {
        // Local filesystem path
        if (!fs.existsSync(filePathOrUrl)) {
          console.error(`→ DropboxService: File not found: ${filePathOrUrl}`);
          return false;
        }
        fileContent = fs.readFileSync(filePathOrUrl);
        sourceFilename = path.basename(filePathOrUrl);
      }
      
      const response = await fetch("https://content.dropboxapi.com/2/files/upload", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.accessToken}`,
          "Dropbox-API-Arg": JSON.stringify({
            path: dropboxPath,
            mode: "add",
            autorename: true,
          }),
          "Content-Type": "application/octet-stream",
        },
        body: fileContent,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Dropbox upload failed:", errorText);
        return false;
      }

      const result = await response.json();
      console.log("→ DropboxService: File uploaded to Dropbox:", result.path_display);
      
      // Store metadata
      const metadata: DropboxFileMetadata = {
        filename: sourceFilename,
        dropboxPath: result.path_display,
        uploadedAt: new Date(),
        size: result.size,
        shipId: this.extractShipIdFromPath(dropboxPath),
        reportType: this.extractReportTypeFromPath(dropboxPath)
      };
      this.uploadMetadata.set(result.path_display, metadata);
      
      return true;
    } catch (error) {
      console.error("Dropbox upload error:", error);
      return false;
    }
  }

  private extractShipIdFromPath(dropboxPath: string): string {
    const pathParts = dropboxPath.split('/');
    for (const part of pathParts) {
      if (part.startsWith('ship-')) {
        return part;
      }
      if (part.toLowerCase() === 'consolidated') {
        return 'consolidated';
      }
    }
    return 'unknown';
  }

  private extractReportTypeFromPath(dropboxPath: string): string {
    const filename = path.basename(dropboxPath).toLowerCase();
    if (filename.includes('eod')) return 'eod';
    if (filename.includes('dispatch')) return 'dispatch';
    if (filename.includes('consolidated_pax') || filename.includes('consolidated-pax')) return 'consolidated-pax';
    if (filename.includes('pax')) return 'pax';
    return 'unknown';
  }

  private generateOrganizedPath(shipId: string, reportType: string, filename: string): string {
    const today = format(new Date(), 'yyyy-MM-dd');
    if (reportType === 'consolidated-pax') {
      return `/Maritime_Reports/Consolidated/${today}/PAX/${filename}`;
    }
    return `/Maritime_Reports/${shipId}/${today}/${reportType}/${filename}`;
  }

  async batchUploadReports(
    files: Array<{ localPath: string; reportType: 'eod' | 'dispatch' | 'pax' | 'consolidated-pax'; filename: string }>,
    shipId: string,
    createSharedFolder: boolean = true
  ): Promise<BatchUploadResult> {
    if (!this.accessToken) {
      return {
        success: false,
        uploadedFiles: [],
        failedFiles: files.map(f => ({ filename: f.filename, error: 'Dropbox not configured' }))
      };
    }

    const uploadedFiles: DropboxFileMetadata[] = [];
    const failedFiles: { filename: string; error: string }[] = [];
    
    // Create folder structure first
    const today = format(new Date(), 'yyyy-MM-dd');
    const basePath = `/Maritime_Reports/${shipId}/${today}`;
    
    try {
      await this.createFolder(basePath);
    } catch (error) {
      console.warn('Base folder creation failed (may already exist):', error);
    }

    // Upload each file
    for (const file of files) {
      try {
        const organizedPath = this.generateOrganizedPath(shipId, file.reportType, file.filename);
        
        // Create subfolder for report type
        const subfolderPath = path.dirname(organizedPath);
        try {
          await this.createFolder(subfolderPath);
        } catch (error) {
          console.warn(`Subfolder creation failed for ${subfolderPath} (may already exist)`);
        }
        
        const success = await this.uploadFile(file.localPath, organizedPath);
        
        if (success) {
          const metadata = this.uploadMetadata.get(organizedPath);
          if (metadata) {
            // Generate shared link for individual file
            const sharedLink = await this.createSharedLink(organizedPath);
            if (sharedLink) {
              metadata.sharedLink = sharedLink;
            }
            uploadedFiles.push(metadata);
          }
        } else {
          failedFiles.push({ filename: file.filename, error: 'Upload failed' });
        }
      } catch (error) {
        failedFiles.push({ 
          filename: file.filename, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }

    let sharedFolderLink: string | undefined;
    if (createSharedFolder && uploadedFiles.length > 0) {
      sharedFolderLink = await this.createSharedLink(basePath) || undefined;
    }

    return {
      success: failedFiles.length === 0,
      uploadedFiles,
      failedFiles,
      sharedFolderLink
    };
  }

  private async createFolder(folderPath: string): Promise<boolean> {
    try {
      const response = await fetch("https://api.dropboxapi.com/2/files/create_folder_v2", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          path: folderPath,
          autorename: false,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        if (!errorText.includes('already exists')) {
          throw new Error(errorText);
        }
      }

      return true;
    } catch (error) {
      console.error("Folder creation error:", error);
      return false;
    }
  }

  async createSharedLinkWithExpiration(dropboxPath: string, expirationDays: number = 30): Promise<string | null> {
    if (!this.accessToken) {
      return null;
    }

    try {
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + expirationDays);

      const response = await fetch("https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          path: dropboxPath,
          settings: {
            requested_visibility: "public",
            expires: expirationDate.toISOString(),
            link_password: null,
            allow_download: true
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Failed to create shared link with expiration:", errorText);
        return null;
      }

      const result = await response.json();
      return result.url;
    } catch (error) {
      console.error("Shared link creation error:", error);
      return null;
    }
  }

  getUploadMetadata(dropboxPath: string): DropboxFileMetadata | undefined {
    return this.uploadMetadata.get(dropboxPath);
  }

  getAllUploadMetadata(): DropboxFileMetadata[] {
    return Array.from(this.uploadMetadata.values());
  }

  async createSharedLink(dropboxPath: string): Promise<string | null> {
    if (!this.accessToken) {
      return null;
    }

    try {
      const response = await fetch("https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          path: dropboxPath,
          settings: {
            requested_visibility: "public",
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Failed to create shared link:", errorText);
        return null;
      }

      const result = await response.json();
      return result.url;
    } catch (error) {
      console.error("Shared link creation error:", error);
      return null;
    }
  }
}
