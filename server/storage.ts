import { 
  uploadedFiles, 
  excelData, 
  processingJobs,
  dispatchTemplates,
  eodTemplates,
  paxTemplates,
  dispatchRecords,
  generatedReports,
  dispatchVersions,
  extractedDispatchData,
  consolidatedPaxReports,
  dispatchSessions,
  type UploadedFile, 
  type ExcelData,
  type ProcessingJob,
  type DispatchTemplate,
  type EodTemplate,
  type PaxTemplate,
  type DispatchRecord,
  type GeneratedReport,
  type DispatchVersion,
  type ExtractedDispatchData,
  type ConsolidatedPaxReport,
  type DispatchSession,
  type InsertUploadedFile, 
  type InsertExcelData,
  type InsertProcessingJob,
  type InsertDispatchTemplate,
  type InsertEodTemplate,
  type InsertPaxTemplate,
  type InsertDispatchRecord,
  type InsertGeneratedReport,
  type InsertDispatchVersion,
  type InsertExtractedDispatchData,
  type InsertConsolidatedPaxReport,
  type InsertDispatchSession
} from "@shared/schema";
import { db, withRetry } from "./db.js";
import { eq, desc, and } from "drizzle-orm";

export interface IStorage {
  // File operations
  createUploadedFile(file: InsertUploadedFile): Promise<UploadedFile>;
  getUploadedFile(id: number): Promise<UploadedFile | undefined>;
  
  // Excel data operations
  createExcelData(data: InsertExcelData): Promise<ExcelData>;
  getExcelDataByFileId(fileId: number): Promise<ExcelData[]>;
  
  // Processing job operations (ship-aware)
  createProcessingJob(job: InsertProcessingJob): Promise<ProcessingJob>;
  getProcessingJob(id: number): Promise<ProcessingJob | undefined>;
  updateProcessingJob(id: number, updates: Partial<ProcessingJob>): Promise<ProcessingJob>;
  getProcessingJobsByFileId(fileId: number): Promise<ProcessingJob[]>;
  getRecentProcessingJobs(limit?: number, shipId?: string): Promise<(ProcessingJob & { file: UploadedFile })[]>;

  // Template operations (ship-aware)
  createDispatchTemplate(template: InsertDispatchTemplate): Promise<DispatchTemplate>;
  getActiveDispatchTemplate(shipId?: string): Promise<DispatchTemplate | undefined>;
  createEodTemplate(template: InsertEodTemplate): Promise<EodTemplate>;
  getActiveEodTemplate(shipId?: string): Promise<EodTemplate | undefined>;
  createPaxTemplate(template: InsertPaxTemplate): Promise<PaxTemplate>;
  getActivePaxTemplate(shipId?: string): Promise<PaxTemplate | undefined>;

  // Dispatch record operations
  createDispatchRecord(record: InsertDispatchRecord): Promise<DispatchRecord>;
  getAllActiveDispatchRecords(): Promise<DispatchRecord[]>;
  getDispatchRecord(id: number): Promise<DispatchRecord | undefined>;

  // Generated report operations (ship-aware)
  createGeneratedReport(report: InsertGeneratedReport): Promise<GeneratedReport>;
  getRecentGeneratedReports(limit?: number, shipId?: string): Promise<GeneratedReport[]>;
  getGeneratedReport(id: number): Promise<GeneratedReport | undefined>;

  // Dispatch version operations (ship-aware)
  createDispatchVersion(version: InsertDispatchVersion): Promise<DispatchVersion>;
  getDispatchVersions(limit?: number, shipId?: string): Promise<DispatchVersion[]>;
  getDispatchVersion(id: number): Promise<DispatchVersion | undefined>;

  // Extracted dispatch data operations
  createExtractedDispatchData(data: InsertExtractedDispatchData): Promise<ExtractedDispatchData>;
  getExtractedDispatchData(dispatchFileId: number): Promise<ExtractedDispatchData | undefined>;

  // Consolidated PAX report operations
  createConsolidatedPaxReport(report: InsertConsolidatedPaxReport): Promise<ConsolidatedPaxReport>;
  getRecentConsolidatedPaxReports(limit?: number): Promise<ConsolidatedPaxReport[]>;
  getConsolidatedPaxReport(id: number): Promise<ConsolidatedPaxReport | undefined>;
  getConsolidatedPaxReportByFilename(filename: string): Promise<ConsolidatedPaxReport | undefined>;

  // Dispatch session operations
  createDispatchSession(session: InsertDispatchSession): Promise<DispatchSession>;
  getDispatchSession(id: string): Promise<DispatchSession | undefined>;
  updateDispatchSession(id: string, updates: Partial<DispatchSession>): Promise<DispatchSession>;
  getActiveDispatchSession(userId: number, shipId: string): Promise<DispatchSession | undefined>;
  getUserDispatchSessions(userId: number, limit?: number): Promise<DispatchSession[]>;
  closeDispatchSession(id: string): Promise<DispatchSession>;
}

export class DatabaseStorage implements IStorage {
  async createUploadedFile(file: InsertUploadedFile): Promise<UploadedFile> {
    return withRetry(async () => {
      const [created] = await db
        .insert(uploadedFiles)
        .values(file)
        .returning();
      return created;
    });
  }

  async getUploadedFile(id: number): Promise<UploadedFile | undefined> {
    const [file] = await db
      .select()
      .from(uploadedFiles)
      .where(eq(uploadedFiles.id, id));
    return file || undefined;
  }

  async createExcelData(data: InsertExcelData): Promise<ExcelData> {
    const [created] = await db
      .insert(excelData)
      .values(data)
      .returning();
    return created;
  }

  async getExcelDataByFileId(fileId: number): Promise<ExcelData[]> {
    return await db
      .select()
      .from(excelData)
      .where(eq(excelData.fileId, fileId));
  }

  async createProcessingJob(job: InsertProcessingJob): Promise<ProcessingJob> {
    return withRetry(async () => {
      const [created] = await db
        .insert(processingJobs)
        .values(job)
        .returning();
      return created;
    });
  }

  async getProcessingJob(id: number): Promise<ProcessingJob | undefined> {
    return withRetry(async () => {
      const [job] = await db
        .select()
        .from(processingJobs)
        .where(eq(processingJobs.id, id));
      return job || undefined;
    });
  }

  async updateProcessingJob(id: number, updates: Partial<ProcessingJob>): Promise<ProcessingJob> {
    const [updated] = await db
      .update(processingJobs)
      .set(updates)
      .where(eq(processingJobs.id, id))
      .returning();
    return updated;
  }

  async getProcessingJobsByFileId(fileId: number): Promise<ProcessingJob[]> {
    return await db
      .select()
      .from(processingJobs)
      .where(eq(processingJobs.fileId, fileId));
  }

  async getRecentProcessingJobs(limit: number = 10, shipId?: string): Promise<(ProcessingJob & { file: UploadedFile })[]> {
    const baseQuery = db
      .select()
      .from(processingJobs)
      .innerJoin(uploadedFiles, eq(processingJobs.fileId, uploadedFiles.id))
      .orderBy(desc(processingJobs.createdAt))
      .limit(limit);
    
    const results = shipId 
      ? await baseQuery.where(eq(processingJobs.shipId, shipId))
      : await baseQuery;
    
    return results.map(result => ({
      ...result.processing_jobs,
      file: result.uploaded_files
    }));
  }

  // Template operations
  async createDispatchTemplate(template: InsertDispatchTemplate): Promise<DispatchTemplate> {
    // Deactivate existing templates for this ship only
    const shipId = template.shipId || 'ship-a';
    await db
      .update(dispatchTemplates)
      .set({ isActive: false })
      .where(eq(dispatchTemplates.shipId, shipId));
    
    const [newTemplate] = await db
      .insert(dispatchTemplates)
      .values(template)
      .returning();
    return newTemplate;
  }

  async getActiveDispatchTemplate(shipId?: string): Promise<DispatchTemplate | undefined> {
    const targetShipId = shipId || 'ship-a';
    const [template] = await db
      .select()
      .from(dispatchTemplates)
      .where(and(
        eq(dispatchTemplates.isActive, true),
        eq(dispatchTemplates.shipId, targetShipId)
      ))
      .orderBy(desc(dispatchTemplates.createdAt))
      .limit(1);
    return template || undefined;
  }

  async createEodTemplate(template: InsertEodTemplate): Promise<EodTemplate> {
    // Deactivate existing templates for this ship only
    const shipId = template.shipId || 'ship-a';
    await db
      .update(eodTemplates)
      .set({ isActive: false })
      .where(eq(eodTemplates.shipId, shipId));
    
    const [newTemplate] = await db
      .insert(eodTemplates)
      .values(template)
      .returning();
    return newTemplate;
  }

  async getActiveEodTemplate(shipId?: string): Promise<EodTemplate | undefined> {
    const targetShipId = shipId || 'ship-a';
    const [template] = await db
      .select()
      .from(eodTemplates)
      .where(and(
        eq(eodTemplates.isActive, true),
        eq(eodTemplates.shipId, targetShipId)
      ))
      .orderBy(desc(eodTemplates.createdAt))
      .limit(1);
    return template || undefined;
  }

  async createPaxTemplate(template: InsertPaxTemplate): Promise<PaxTemplate> {
    // Deactivate existing templates (PAX templates are system-wide)
    await db
      .update(paxTemplates)
      .set({ isActive: false })
      .where(eq(paxTemplates.isActive, true));
    
    const [newTemplate] = await db
      .insert(paxTemplates)
      .values(template)
      .returning();
    return newTemplate;
  }

  async getActivePaxTemplate(shipId?: string): Promise<PaxTemplate | undefined> {
    // PAX templates are system-wide, no ship filtering needed
    const [template] = await db
      .select()
      .from(paxTemplates)
      .where(eq(paxTemplates.isActive, true))
      .orderBy(desc(paxTemplates.createdAt))
      .limit(1);
    return template || undefined;
  }

  // Dispatch record operations
  async createDispatchRecord(record: InsertDispatchRecord): Promise<DispatchRecord> {
    const [newRecord] = await db
      .insert(dispatchRecords)
      .values(record)
      .returning();
    return newRecord;
  }

  async getAllActiveDispatchRecords(): Promise<DispatchRecord[]> {
    return await db
      .select()
      .from(dispatchRecords)
      .where(eq(dispatchRecords.isActive, true))
      .orderBy(desc(dispatchRecords.createdAt));
  }

  async getDispatchRecord(id: number): Promise<DispatchRecord | undefined> {
    const [record] = await db
      .select()
      .from(dispatchRecords)
      .where(eq(dispatchRecords.id, id));
    return record || undefined;
  }

  // Generated report operations
  async createGeneratedReport(report: InsertGeneratedReport): Promise<GeneratedReport> {
    const [newReport] = await db
      .insert(generatedReports)
      .values(report)
      .returning();
    return newReport;
  }

  async getRecentGeneratedReports(limit: number = 10, shipId?: string): Promise<GeneratedReport[]> {
    const query = db
      .select()
      .from(generatedReports)
      .orderBy(desc(generatedReports.createdAt))
      .limit(limit);
    
    if (shipId) {
      return await query.where(eq(generatedReports.shipId, shipId));
    }
    return await query;
  }

  async getGeneratedReport(id: number): Promise<GeneratedReport | undefined> {
    const [report] = await db
      .select()
      .from(generatedReports)
      .where(eq(generatedReports.id, id));
    return report || undefined;
  }

  // Dispatch version operations
  async createDispatchVersion(version: InsertDispatchVersion): Promise<DispatchVersion> {
    const [newVersion] = await db
      .insert(dispatchVersions)
      .values(version)
      .returning();
    return newVersion;
  }

  async getDispatchVersions(limit: number = 10, shipId?: string): Promise<DispatchVersion[]> {
    const query = db
      .select()
      .from(dispatchVersions)
      .orderBy(desc(dispatchVersions.createdAt))
      .limit(limit);
    
    if (shipId) {
      return await query.where(eq(dispatchVersions.shipId, shipId));
    }
    return await query;
  }

  async getDispatchVersion(id: number): Promise<DispatchVersion | undefined> {
    const [version] = await db
      .select()
      .from(dispatchVersions)
      .where(eq(dispatchVersions.id, id));
    return version || undefined;
  }

  async createExtractedDispatchData(data: InsertExtractedDispatchData): Promise<ExtractedDispatchData> {
    const [inserted] = await db.insert(extractedDispatchData).values(data).returning();
    return inserted;
  }

  async getExtractedDispatchData(dispatchFileId: number): Promise<ExtractedDispatchData | undefined> {
    const result = await db.select().from(extractedDispatchData)
      .where(eq(extractedDispatchData.dispatchFileId, dispatchFileId))
      .orderBy(desc(extractedDispatchData.extractedAt))
      .limit(1);
    return result[0];
  }

  // Consolidated PAX report operations
  async createConsolidatedPaxReport(report: InsertConsolidatedPaxReport): Promise<ConsolidatedPaxReport> {
    const reportData = {
      ...report,
      contributingShips: Array.isArray(report.contributingShips) ? [...report.contributingShips] : []
    };
    const [newReport] = await db
      .insert(consolidatedPaxReports)
      .values([reportData as any])
      .returning();
    return newReport;
  }

  async getRecentConsolidatedPaxReports(limit: number = 10): Promise<ConsolidatedPaxReport[]> {
    return await db
      .select()
      .from(consolidatedPaxReports)
      .orderBy(desc(consolidatedPaxReports.createdAt))
      .limit(limit);
  }

  async getConsolidatedPaxReport(id: number): Promise<ConsolidatedPaxReport | undefined> {
    const [report] = await db
      .select()
      .from(consolidatedPaxReports)
      .where(eq(consolidatedPaxReports.id, id));
    return report || undefined;
  }

  async getConsolidatedPaxReportByFilename(filename: string): Promise<ConsolidatedPaxReport | undefined> {
    const [report] = await db
      .select()
      .from(consolidatedPaxReports)
      .where(eq(consolidatedPaxReports.filename, filename));
    return report || undefined;
  }

  // Dispatch session operations
  async createDispatchSession(session: InsertDispatchSession): Promise<DispatchSession> {
    return withRetry(async () => {
      const [created] = await db
        .insert(dispatchSessions)
        .values(session)
        .returning();
      return created;
    });
  }

  async getDispatchSession(id: string): Promise<DispatchSession | undefined> {
    const [session] = await db
      .select()
      .from(dispatchSessions)
      .where(eq(dispatchSessions.id, id));
    return session || undefined;
  }

  async updateDispatchSession(id: string, updates: Partial<DispatchSession>): Promise<DispatchSession> {
    const [updated] = await db
      .update(dispatchSessions)
      .set({ ...updates, updatedAt: new Date(), lastActivity: new Date() })
      .where(eq(dispatchSessions.id, id))
      .returning();
    return updated;
  }

  async getActiveDispatchSession(userId: number, shipId: string): Promise<DispatchSession | undefined> {
    const [session] = await db
      .select()
      .from(dispatchSessions)
      .where(and(
        eq(dispatchSessions.userId, userId),
        eq(dispatchSessions.shipId, shipId),
        eq(dispatchSessions.status, 'active')
      ))
      .orderBy(desc(dispatchSessions.lastActivity))
      .limit(1);
    return session || undefined;
  }

  async getUserDispatchSessions(userId: number, limit: number = 10): Promise<DispatchSession[]> {
    return await db
      .select()
      .from(dispatchSessions)
      .where(eq(dispatchSessions.userId, userId))
      .orderBy(desc(dispatchSessions.lastActivity))
      .limit(limit);
  }

  async closeDispatchSession(id: string): Promise<DispatchSession> {
    const [updated] = await db
      .update(dispatchSessions)
      .set({ status: 'completed', updatedAt: new Date() })
      .where(eq(dispatchSessions.id, id))
      .returning();
    return updated;
  }
}

export const storage = new DatabaseStorage();
