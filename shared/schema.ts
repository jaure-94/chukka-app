import { pgTable, text, serial, integer, boolean, timestamp, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export const uploadedFiles = pgTable("uploaded_files", {
  id: serial("id").primaryKey(),
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  mimetype: text("mimetype").notNull(),
  size: integer("size").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
});

export const excelData = pgTable("excel_data", {
  id: serial("id").primaryKey(),
  fileId: integer("file_id").notNull().references(() => uploadedFiles.id),
  sheetName: text("sheet_name").notNull(),
  rowIndex: integer("row_index").notNull(),
  data: json("data").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const processingJobs = pgTable("processing_jobs", {
  id: serial("id").primaryKey(),
  fileId: integer("file_id").notNull().references(() => uploadedFiles.id),
  templateType: text("template_type").notNull(),
  status: text("status").notNull().default("pending"), // pending, processing, completed, failed
  progress: integer("progress").notNull().default(0),
  resultFilePath: text("result_file_path"),
  dropboxExported: boolean("dropbox_exported").default(false),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const uploadedFilesRelations = relations(uploadedFiles, ({ many }) => ({
  excelData: many(excelData),
  processingJobs: many(processingJobs),
}));

export const excelDataRelations = relations(excelData, ({ one }) => ({
  file: one(uploadedFiles, {
    fields: [excelData.fileId],
    references: [uploadedFiles.id],
  }),
}));

export const processingJobsRelations = relations(processingJobs, ({ one }) => ({
  file: one(uploadedFiles, {
    fields: [processingJobs.fileId],
    references: [uploadedFiles.id],
  }),
}));

export const insertUploadedFileSchema = createInsertSchema(uploadedFiles).omit({
  id: true,
  uploadedAt: true,
});

export const insertExcelDataSchema = createInsertSchema(excelData).omit({
  id: true,
  createdAt: true,
});

export const insertProcessingJobSchema = createInsertSchema(processingJobs).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export type InsertUploadedFile = z.infer<typeof insertUploadedFileSchema>;
export type InsertExcelData = z.infer<typeof insertExcelDataSchema>;
export type InsertProcessingJob = z.infer<typeof insertProcessingJobSchema>;

export type UploadedFile = typeof uploadedFiles.$inferSelect;
export type ExcelData = typeof excelData.$inferSelect;
export type ProcessingJob = typeof processingJobs.$inferSelect;
