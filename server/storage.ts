import { 
  uploadedFiles, 
  excelData, 
  processingJobs,
  dispatchTemplates,
  eodTemplates,
  dispatchRecords,
  generatedReports,
  type UploadedFile, 
  type ExcelData,
  type ProcessingJob,
  type DispatchTemplate,
  type EodTemplate,
  type DispatchRecord,
  type GeneratedReport,
  type InsertUploadedFile, 
  type InsertExcelData,
  type InsertProcessingJob,
  type InsertDispatchTemplate,
  type InsertEodTemplate,
  type InsertDispatchRecord,
  type InsertGeneratedReport
} from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  // File operations
  createUploadedFile(file: InsertUploadedFile): Promise<UploadedFile>;
  getUploadedFile(id: number): Promise<UploadedFile | undefined>;
  
  // Excel data operations
  createExcelData(data: InsertExcelData): Promise<ExcelData>;
  getExcelDataByFileId(fileId: number): Promise<ExcelData[]>;
  
  // Processing job operations
  createProcessingJob(job: InsertProcessingJob): Promise<ProcessingJob>;
  getProcessingJob(id: number): Promise<ProcessingJob | undefined>;
  updateProcessingJob(id: number, updates: Partial<ProcessingJob>): Promise<ProcessingJob>;
  getProcessingJobsByFileId(fileId: number): Promise<ProcessingJob[]>;
  getRecentProcessingJobs(limit?: number): Promise<(ProcessingJob & { file: UploadedFile })[]>;

  // Template operations
  createDispatchTemplate(template: InsertDispatchTemplate): Promise<DispatchTemplate>;
  getActiveDispatchTemplate(): Promise<DispatchTemplate | undefined>;
  createEodTemplate(template: InsertEodTemplate): Promise<EodTemplate>;
  getActiveEodTemplate(): Promise<EodTemplate | undefined>;

  // Dispatch record operations
  createDispatchRecord(record: InsertDispatchRecord): Promise<DispatchRecord>;
  getAllActiveDispatchRecords(): Promise<DispatchRecord[]>;
  getDispatchRecord(id: number): Promise<DispatchRecord | undefined>;

  // Generated report operations
  createGeneratedReport(report: InsertGeneratedReport): Promise<GeneratedReport>;
  getRecentGeneratedReports(limit?: number): Promise<GeneratedReport[]>;
  getGeneratedReport(id: number): Promise<GeneratedReport | undefined>;
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

  async getRecentProcessingJobs(limit: number = 10): Promise<(ProcessingJob & { file: UploadedFile })[]> {
    const results = await db
      .select()
      .from(processingJobs)
      .innerJoin(uploadedFiles, eq(processingJobs.fileId, uploadedFiles.id))
      .orderBy(desc(processingJobs.createdAt))
      .limit(limit);
    
    return results.map(result => ({
      ...result.processing_jobs,
      file: result.uploaded_files
    }));
  }

  // Template operations
  async createDispatchTemplate(template: InsertDispatchTemplate): Promise<DispatchTemplate> {
    // Deactivate existing templates
    await db.update(dispatchTemplates).set({ isActive: false });
    
    const [newTemplate] = await db
      .insert(dispatchTemplates)
      .values(template)
      .returning();
    return newTemplate;
  }

  async getActiveDispatchTemplate(): Promise<DispatchTemplate | undefined> {
    const [template] = await db
      .select()
      .from(dispatchTemplates)
      .where(eq(dispatchTemplates.isActive, true))
      .orderBy(desc(dispatchTemplates.createdAt))
      .limit(1);
    return template || undefined;
  }

  async createEodTemplate(template: InsertEodTemplate): Promise<EodTemplate> {
    // Deactivate existing templates
    await db.update(eodTemplates).set({ isActive: false });
    
    const [newTemplate] = await db
      .insert(eodTemplates)
      .values(template)
      .returning();
    return newTemplate;
  }

  async getActiveEodTemplate(): Promise<EodTemplate | undefined> {
    const [template] = await db
      .select()
      .from(eodTemplates)
      .where(eq(eodTemplates.isActive, true))
      .orderBy(desc(eodTemplates.createdAt))
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

  async getRecentGeneratedReports(limit: number = 10): Promise<GeneratedReport[]> {
    return await db
      .select()
      .from(generatedReports)
      .orderBy(desc(generatedReports.createdAt))
      .limit(limit);
  }

  async getGeneratedReport(id: number): Promise<GeneratedReport | undefined> {
    const [report] = await db
      .select()
      .from(generatedReports)
      .where(eq(generatedReports.id, id));
    return report || undefined;
  }
}

export const storage = new DatabaseStorage();
