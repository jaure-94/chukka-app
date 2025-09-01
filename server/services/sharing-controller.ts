import { eq, desc, and } from "drizzle-orm";
import { db } from "../db";
import { 
  sharingActivities, 
  shareTemplates, 
  type InsertSharingActivity, 
  type InsertShareTemplate, 
  type SharingActivity, 
  type ShareTemplate 
} from "@shared/schema";
import { EmailService } from "./email-service";
import { DropboxService } from "./dropbox-service";
import fs from "fs";
import path from "path";

export class SharingController {
  private emailService: EmailService;
  private dropboxService: DropboxService;

  constructor() {
    this.emailService = new EmailService();
    this.dropboxService = new DropboxService();
  }

  async shareReports(params: {
    userId: number;
    shipId: string;
    reportTypes: ('eod' | 'dispatch' | 'pax')[];
    shareMethod: 'email' | 'dropbox' | 'both';
    recipients?: string[];
    reportFiles: Array<{ path: string; filename: string; type: 'eod' | 'dispatch' | 'pax' }>;
    userEmail: string;
    userName: string;
  }): Promise<{
    success: boolean;
    sharingActivityId: number;
    message: string;
    details?: {
      emailResult?: any;
      dropboxResult?: any;
    };
  }> {
    // Create sharing activity record
    const sharingActivity: InsertSharingActivity = {
      userId: params.userId,
      shipId: params.shipId,
      reportTypes: params.reportTypes as ('eod' | 'dispatch' | 'pax')[],
      shareMethod: params.shareMethod,
      recipients: params.recipients || [],
      dropboxLinks: [],
      emailStatus: params.shareMethod === 'dropbox' ? undefined : 'pending',
      dropboxStatus: params.shareMethod === 'email' ? undefined : 'pending',
      status: 'pending',
      metadata: {
        reportFilenames: params.reportFiles.map(f => f.filename),
        sharedBy: params.userName,
      },
    };

    const [activity] = await db.insert(sharingActivities).values([sharingActivity]).returning();
    console.log(`Created sharing activity ${activity.id} for user ${params.userId}`);

    let emailResult: any = null;
    let dropboxResult: any = null;
    let overallStatus = 'completed';
    let errorMessage = '';

    try {
      // Handle Dropbox sharing
      if (params.shareMethod === 'dropbox' || params.shareMethod === 'both') {
        console.log(`Starting Dropbox upload for ${params.reportFiles.length} files`);
        
        const dropboxFiles = params.reportFiles.map(file => ({
          localPath: file.path,
          reportType: file.type,
          filename: file.filename,
        }));

        dropboxResult = await this.dropboxService.batchUploadReports(dropboxFiles, params.shipId, true);
        
        if (dropboxResult.success) {
          await db.update(sharingActivities)
            .set({
              dropboxStatus: 'uploaded',
              dropboxLinks: dropboxResult.uploadedFiles.map((f: any) => f.sharedLink).filter(Boolean),
              metadata: {
                ...activity.metadata,
                dropboxFolderPath: dropboxResult.sharedFolderLink,
              },
            })
            .where(eq(sharingActivities.id, activity.id));
            
          console.log(`Dropbox upload completed for activity ${activity.id}`);
        } else {
          await db.update(sharingActivities)
            .set({ dropboxStatus: 'failed' })
            .where(eq(sharingActivities.id, activity.id));
            
          overallStatus = 'partial';
          errorMessage += `Dropbox upload failed: ${dropboxResult.failedFiles.map((f: any) => f.error).join(', ')}; `;
          console.error(`Dropbox upload failed for activity ${activity.id}:`, dropboxResult.failedFiles);
        }
      }

      // Handle Email sharing
      if (params.shareMethod === 'email' || params.shareMethod === 'both') {
        if (!params.recipients || params.recipients.length === 0) {
          throw new Error('Recipients required for email sharing');
        }

        console.log(`Starting email sharing to ${params.recipients.length} recipient(s)`);

        // Prepare email attachments
        const emailAttachments = params.reportFiles.map(file => ({
          filename: file.filename,
          content: fs.readFileSync(file.path),
          type: path.extname(file.filename) === '.xlsx' 
            ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            : 'application/octet-stream',
        }));

        const emailOptions = {
          reportTypes: params.reportTypes,
          shipName: this.getShipName(params.shipId),
          shipId: params.shipId,
          attachments: emailAttachments,
          generatedDate: new Date(),
          sharedBy: params.userName,
        };

        emailResult = await this.emailService.shareReports(
          params.recipients,
          params.userEmail,
          emailOptions
        );

        if (emailResult.success) {
          await db.update(sharingActivities)
            .set({ 
              emailStatus: 'sent',
              metadata: {
                ...activity.metadata,
                emailSubject: `Maritime Reports - ${params.reportTypes.join(', ')} for ${this.getShipName(params.shipId)}`,
              },
            })
            .where(eq(sharingActivities.id, activity.id));
            
          console.log(`Email sharing completed for activity ${activity.id}`);
        } else {
          await db.update(sharingActivities)
            .set({ 
              emailStatus: 'failed',
              metadata: {
                ...activity.metadata,
                failedRecipients: emailResult.failedRecipients,
              },
            })
            .where(eq(sharingActivities.id, activity.id));
            
          if (emailResult.failedRecipients && emailResult.failedRecipients.length > 0) {
            overallStatus = 'partial';
          } else {
            overallStatus = 'failed';
          }
          
          errorMessage += `Email sharing failed: ${emailResult.message}; `;
          console.error(`Email sharing failed for activity ${activity.id}:`, emailResult.message);
        }
      }

      // Update final status
      await db.update(sharingActivities)
        .set({
          status: overallStatus,
          errorMessage: errorMessage || null,
          completedAt: new Date(),
        })
        .where(eq(sharingActivities.id, activity.id));

      const successMessage = this.generateSuccessMessage(params.shareMethod, emailResult, dropboxResult);
      
      return {
        success: overallStatus !== 'failed',
        sharingActivityId: activity.id,
        message: errorMessage ? `${successMessage} ${errorMessage}` : successMessage,
        details: { emailResult, dropboxResult },
      };

    } catch (error) {
      console.error(`Sharing failed for activity ${activity.id}:`, error);
      
      await db.update(sharingActivities)
        .set({
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          completedAt: new Date(),
        })
        .where(eq(sharingActivities.id, activity.id));

      return {
        success: false,
        sharingActivityId: activity.id,
        message: `Sharing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { emailResult, dropboxResult },
      };
    }
  }

  private generateSuccessMessage(shareMethod: string, emailResult: any, dropboxResult: any): string {
    const messages = [];
    
    if ((shareMethod === 'email' || shareMethod === 'both') && emailResult?.success) {
      messages.push('Reports successfully emailed');
    }
    
    if ((shareMethod === 'dropbox' || shareMethod === 'both') && dropboxResult?.success) {
      messages.push('Reports uploaded to Dropbox');
    }
    
    return messages.join(' and ') || 'Sharing completed';
  }

  private getShipName(shipId: string): string {
    const shipNames = {
      'ship-a': 'Ship A',
      'ship-b': 'Ship B', 
      'ship-c': 'Ship C',
    };
    return shipNames[shipId as keyof typeof shipNames] || shipId.toUpperCase();
  }

  async getSharingHistory(
    userId: number, 
    shipId?: string, 
    limit: number = 50
  ): Promise<SharingActivity[]> {
    let query = db.select().from(sharingActivities)
      .where(eq(sharingActivities.userId, userId))
      .orderBy(desc(sharingActivities.createdAt))
      .limit(limit);

    if (shipId) {
      query = db.select().from(sharingActivities)
        .where(and(eq(sharingActivities.userId, userId), eq(sharingActivities.shipId, shipId)))
        .orderBy(desc(sharingActivities.createdAt))
        .limit(limit);
    }

    return await query;
  }

  async createShareTemplate(template: InsertShareTemplate): Promise<ShareTemplate> {
    const templateData = {
      ...template,
      reportTypes: template.reportTypes as ('eod' | 'dispatch' | 'pax')[]
    };
    const [newTemplate] = await db.insert(shareTemplates).values([templateData]).returning();
    return newTemplate;
  }

  async getShareTemplates(userId: number, shipId?: string): Promise<ShareTemplate[]> {
    let query = db.select().from(shareTemplates)
      .where(and(eq(shareTemplates.userId, userId), eq(shareTemplates.isActive, true)))
      .orderBy(desc(shareTemplates.createdAt));

    if (shipId) {
      query = db.select().from(shareTemplates)
        .where(and(
          eq(shareTemplates.userId, userId), 
          eq(shareTemplates.shipId, shipId),
          eq(shareTemplates.isActive, true)
        ))
        .orderBy(desc(shareTemplates.createdAt));
    }

    return await query;
  }

  async updateShareTemplate(
    templateId: number, 
    userId: number, 
    updates: Partial<Omit<ShareTemplate, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>
  ): Promise<ShareTemplate | null> {
    const [updated] = await db.update(shareTemplates)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(shareTemplates.id, templateId), eq(shareTemplates.userId, userId)))
      .returning();

    return updated || null;
  }

  async deleteShareTemplate(templateId: number, userId: number): Promise<boolean> {
    const [deleted] = await db.update(shareTemplates)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(shareTemplates.id, templateId), eq(shareTemplates.userId, userId)))
      .returning();

    return !!deleted;
  }

  async getRecentSharingStats(userId: number, days: number = 30): Promise<{
    totalShares: number;
    successfulShares: number;
    emailShares: number;
    dropboxShares: number;
    recentActivities: SharingActivity[];
  }> {
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - days);

    const activities = await db.select().from(sharingActivities)
      .where(and(
        eq(sharingActivities.userId, userId),
        // Note: PostgreSQL date comparison would need proper timestamp comparison in production
      ))
      .orderBy(desc(sharingActivities.createdAt))
      .limit(10);

    const stats = {
      totalShares: activities.length,
      successfulShares: activities.filter(a => a.status === 'completed').length,
      emailShares: activities.filter(a => a.shareMethod === 'email' || a.shareMethod === 'both').length,
      dropboxShares: activities.filter(a => a.shareMethod === 'dropbox' || a.shareMethod === 'both').length,
      recentActivities: activities.slice(0, 5),
    };

    return stats;
  }

  async testServices(): Promise<{
    email: { success: boolean; message: string };
    dropbox: { success: boolean; message: string };
  }> {
    const [emailTest, dropboxTest] = await Promise.all([
      this.emailService.testConnection(),
      this.testDropboxConnection(),
    ]);

    return {
      email: emailTest,
      dropbox: dropboxTest,
    };
  }

  private async testDropboxConnection(): Promise<{ success: boolean; message: string }> {
    if (!process.env.DROPBOX_ACCESS_TOKEN) {
      return {
        success: false,
        message: 'Dropbox access token not configured'
      };
    }

    try {
      // Test by attempting to create a test folder
      const testPath = `/Test_${Date.now()}`;
      const response = await fetch("https://api.dropboxapi.com/2/files/create_folder_v2", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.DROPBOX_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          path: testPath,
          autorename: false,
        }),
      });

      if (response.ok) {
        // Clean up test folder
        await fetch("https://api.dropboxapi.com/2/files/delete_v2", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${process.env.DROPBOX_ACCESS_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ path: testPath }),
        });

        return {
          success: true,
          message: 'Dropbox connection successful'
        };
      } else {
        const errorText = await response.text();
        return {
          success: false,
          message: `Dropbox connection failed: ${errorText}`
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Dropbox test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}