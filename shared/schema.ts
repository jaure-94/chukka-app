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

// New tables for dispatch template and manual records
export const dispatchTemplates = pgTable("dispatch_templates", {
  id: serial("id").primaryKey(),
  filename: text("filename").notNull(),
  originalFilename: text("original_filename").notNull(),
  filePath: text("file_path").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  isActive: boolean("is_active").default(true).notNull(),
});

export const eodTemplates = pgTable("eod_templates", {
  id: serial("id").primaryKey(),
  filename: text("filename").notNull(),
  originalFilename: text("original_filename").notNull(),
  filePath: text("file_path").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  isActive: boolean("is_active").default(true).notNull(),
});

export const dispatchRecords = pgTable("dispatch_records", {
  id: serial("id").primaryKey(),
  tourName: text("tour_name").notNull(),
  numAdult: integer("num_adult").notNull().default(0),
  numChild: integer("num_child").notNull().default(0),
  departure: text("departure"),
  returnTime: text("return_time"),
  comp: integer("comp").default(0),
  totalGuests: integer("total_guests").default(0),
  notes: text("notes"),
  tourDate: text("tour_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  isActive: boolean("is_active").default(true).notNull(),
});

export const generatedReports = pgTable("generated_reports", {
  id: serial("id").primaryKey(),
  dispatchFilePath: text("dispatch_file_path").notNull(),
  eodFilePath: text("eod_file_path"),
  recordCount: integer("record_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

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

export const insertDispatchTemplateSchema = createInsertSchema(dispatchTemplates).omit({
  id: true,
  createdAt: true,
});

export const insertEodTemplateSchema = createInsertSchema(eodTemplates).omit({
  id: true,
  createdAt: true,
});

export const insertDispatchRecordSchema = createInsertSchema(dispatchRecords).omit({
  id: true,
  createdAt: true,
});

export const insertGeneratedReportSchema = createInsertSchema(generatedReports).omit({
  id: true,
  createdAt: true,
});

export type InsertUploadedFile = z.infer<typeof insertUploadedFileSchema>;
export type InsertExcelData = z.infer<typeof insertExcelDataSchema>;
export type InsertProcessingJob = z.infer<typeof insertProcessingJobSchema>;
export type InsertDispatchTemplate = z.infer<typeof insertDispatchTemplateSchema>;
export type InsertEodTemplate = z.infer<typeof insertEodTemplateSchema>;
export type InsertDispatchRecord = z.infer<typeof insertDispatchRecordSchema>;
export type InsertGeneratedReport = z.infer<typeof insertGeneratedReportSchema>;

export type UploadedFile = typeof uploadedFiles.$inferSelect;
export type ExcelData = typeof excelData.$inferSelect;
export type ProcessingJob = typeof processingJobs.$inferSelect;
export type DispatchTemplate = typeof dispatchTemplates.$inferSelect;
export type EodTemplate = typeof eodTemplates.$inferSelect;
export type DispatchRecord = typeof dispatchRecords.$inferSelect;
export type GeneratedReport = typeof generatedReports.$inferSelect;
