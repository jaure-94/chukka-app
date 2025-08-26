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
  shipId: text("ship_id").notNull().default("ship-a"),
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
  shipId: text("ship_id").notNull().default("ship-a"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  isActive: boolean("is_active").default(true).notNull(),
});

export const eodTemplates = pgTable("eod_templates", {
  id: serial("id").primaryKey(),
  filename: text("filename").notNull(),
  originalFilename: text("original_filename").notNull(),
  filePath: text("file_path").notNull(),
  shipId: text("ship_id").notNull().default("ship-a"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  isActive: boolean("is_active").default(true).notNull(),
});

export const paxTemplates = pgTable("pax_templates", {
  id: serial("id").primaryKey(),
  filename: text("filename").notNull(),
  originalFilename: text("original_filename").notNull(),
  filePath: text("file_path").notNull(),
  shipId: text("ship_id").notNull().default("ship-a"),
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
  // Template header fields
  shipName: text("ship_name"),
  tourOperator: text("tour_operator"),
  shorexManager: text("shorex_manager"),
  shorexAsstManager: text("shorex_asst_manager"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  isActive: boolean("is_active").default(true).notNull(),
});

export const generatedReports = pgTable("generated_reports", {
  id: serial("id").primaryKey(),
  dispatchFilePath: text("dispatch_file_path").notNull(),
  eodFilePath: text("eod_file_path"),
  shipId: text("ship_id").notNull().default("ship-a"),
  recordCount: integer("record_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const dispatchVersions = pgTable("dispatch_versions", {
  id: serial("id").primaryKey(),
  filename: text("filename").notNull(),
  originalFilename: text("original_filename").notNull(),
  filePath: text("file_path").notNull(),
  shipId: text("ship_id").notNull().default("ship-a"),
  version: integer("version").notNull().default(1),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const extractedDispatchData = pgTable("extracted_dispatch_data", {
  id: serial("id").primaryKey(),
  dispatchFileId: integer("dispatch_file_id").notNull(),
  shipId: text("ship_id").notNull().default("ship-a"),
  cellA8Value: text("cell_a8_value"), // Tour name from A8
  cellB8Value: text("cell_b8_value"), // Departure time from B8
  cellH8Value: text("cell_h8_value"), // Notes from H8
  extractedAt: timestamp("extracted_at").defaultNow().notNull(),
});

// User authentication and authorization tables
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("user"), // superuser, admin, manager, supervisor, user
  position: text("position"),
  employeeNumber: text("employee_number").unique(),
  email: text("email").notNull().unique(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
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

export const insertPaxTemplateSchema = createInsertSchema(paxTemplates).omit({
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

export const insertDispatchVersionSchema = createInsertSchema(dispatchVersions).omit({
  id: true,
  createdAt: true,
});

export const insertExtractedDispatchDataSchema = createInsertSchema(extractedDispatchData).omit({
  id: true,
  extractedAt: true,
});

// User schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  passwordHash: true,
}).extend({
  password: z.string().min(8, "Password must be at least 8 characters"),
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  lastName: z.string().min(2, "Last name must be at least 2 characters"),
  username: z.string().min(3, "Username must be at least 3 characters"),
  email: z.string().email("Please provide a valid email address"),
  role: z.enum(["superuser", "admin", "manager", "supervisor", "user"]).default("user"),
});

export const loginSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(1, "Password is required"),
});

export const updateUserSchema = insertUserSchema.partial().omit({
  password: true, // Password updates should use separate endpoint
});

export type InsertUploadedFile = z.infer<typeof insertUploadedFileSchema>;
export type InsertExcelData = z.infer<typeof insertExcelDataSchema>;
export type InsertProcessingJob = z.infer<typeof insertProcessingJobSchema>;
export type InsertDispatchTemplate = z.infer<typeof insertDispatchTemplateSchema>;
export type InsertEodTemplate = z.infer<typeof insertEodTemplateSchema>;
export type InsertPaxTemplate = z.infer<typeof insertPaxTemplateSchema>;
export type InsertDispatchRecord = z.infer<typeof insertDispatchRecordSchema>;
export type InsertGeneratedReport = z.infer<typeof insertGeneratedReportSchema>;
export type InsertDispatchVersion = z.infer<typeof insertDispatchVersionSchema>;
export type InsertExtractedDispatchData = z.infer<typeof insertExtractedDispatchDataSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type LoginCredentials = z.infer<typeof loginSchema>;

export type UploadedFile = typeof uploadedFiles.$inferSelect;
export type ExcelData = typeof excelData.$inferSelect;
export type ProcessingJob = typeof processingJobs.$inferSelect;
export type DispatchTemplate = typeof dispatchTemplates.$inferSelect;
export type EodTemplate = typeof eodTemplates.$inferSelect;
export type PaxTemplate = typeof paxTemplates.$inferSelect;
export type DispatchRecord = typeof dispatchRecords.$inferSelect;
export type GeneratedReport = typeof generatedReports.$inferSelect;
export type DispatchVersion = typeof dispatchVersions.$inferSelect;
export type ExtractedDispatchData = typeof extractedDispatchData.$inferSelect;
export type User = typeof users.$inferSelect;

// Role and Permission types
export type UserRole = "superuser" | "admin" | "manager" | "supervisor" | "user";
export type Permission = "create_users" | "edit_users" | "delete_users" | "view_all_users" | 
  "view_dispatch_reports" | "edit_dispatch_reports" | "generate_dispatch_reports" |
  "view_eod_reports" | "edit_eod_reports" | "generate_eod_reports" |
  "view_pax_reports" | "edit_pax_reports" | "generate_pax_reports" |
  "upload_templates" | "edit_templates" | "delete_templates" |
  "view_system_logs" | "manage_system_settings" | "system_admin";
