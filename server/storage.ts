import { 
  uploadedFiles, 
  excelData, 
  processingJobs,
  type UploadedFile, 
  type ExcelData,
  type ProcessingJob,
  type InsertUploadedFile, 
  type InsertExcelData,
  type InsertProcessingJob 
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
    return await db
      .select()
      .from(processingJobs)
      .innerJoin(uploadedFiles, eq(processingJobs.fileId, uploadedFiles.id))
      .orderBy(desc(processingJobs.createdAt))
      .limit(limit);
  }
}

export const storage = new DatabaseStorage();
