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
  type InsertUploadedFile, 
  type InsertExcelData,
  type InsertProcessingJob,
  type InsertDispatchTemplate,
  type InsertEodTemplate,
  type InsertPaxTemplate,
  type InsertDispatchRecord,
  type InsertGeneratedReport,
  type InsertDispatchVersion,
  type InsertExtractedDispatchData
} from "@shared/schema";
import { db } from "./db";
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
}

export class DatabaseStorage implements IStorage {
  async createUploadedFile(file: InsertUploadedFile): Promise<UploadedFile> {
    const [created] = await db
      .insert(uploadedFiles)
      .values(file)
      .returning();
    return created;
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
    const [created] = await db
      .insert(processingJobs)
      .values(job)
      .returning();
    return created;
  }

  async getProcessingJob(id: number): Promise<ProcessingJob | undefined> {
    const [job] = await db
      .select()
      .from(processingJobs)
      .where(eq(processingJobs.id, id));
    return job || undefined;
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
    let query = db
      .select()
      .from(processingJobs)
      .innerJoin(uploadedFiles, eq(processingJobs.fileId, uploadedFiles.id))
      .orderBy(desc(processingJobs.createdAt))
      .limit(limit);
    
    if (shipId) {
      query = query.where(eq(processingJobs.shipId, shipId));
    }
    
    const results = await query;
    
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
    // Deactivate existing templates for this ship only
    const shipId = template.shipId || 'ship-a';
    await db
      .update(paxTemplates)
      .set({ isActive: false })
      .where(eq(paxTemplates.shipId, shipId));
    
    const [newTemplate] = await db
      .insert(paxTemplates)
      .values(template)
      .returning();
    return newTemplate;
  }

  async getActivePaxTemplate(shipId?: string): Promise<PaxTemplate | undefined> {
    const targetShipId = shipId || 'ship-a';
    const [template] = await db
      .select()
      .from(paxTemplates)
      .where(and(
        eq(paxTemplates.isActive, true),
        eq(paxTemplates.shipId, targetShipId)
      ))
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
}

export const storage = new DatabaseStorage();
