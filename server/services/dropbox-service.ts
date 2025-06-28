import fs from "fs";
import path from "path";

export class DropboxService {
  private accessToken: string;

  constructor() {
    this.accessToken = process.env.DROPBOX_ACCESS_TOKEN || process.env.DROPBOX_TOKEN || "";
    
    if (!this.accessToken) {
      console.warn("Dropbox access token not configured. Export functionality will be limited.");
    }
  }

  async uploadFile(localFilePath: string, dropboxPath: string): Promise<boolean> {
    if (!this.accessToken) {
      console.error("Dropbox access token not configured");
      return false;
    }

    try {
      const fileContent = fs.readFileSync(localFilePath);
      
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
      console.log("File uploaded to Dropbox:", result.path_display);
      return true;
    } catch (error) {
      console.error("Dropbox upload error:", error);
      return false;
    }
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
