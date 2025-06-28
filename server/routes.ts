import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import path from "path";
import fs from "fs";
import { ExcelParser } from "./services/excel-parser";
import { TemplateProcessor } from "./services/template-processor";
import { DropboxService } from "./services/dropbox-service";
import { insertUploadedFileSchema, insertProcessingJobSchema } from "@shared/schema";

const upload = multer({ 
  dest: "uploads/",
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files (.xlsx, .xls) are allowed'));
    }
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  const excelParser = new ExcelParser();
  const templateProcessor = new TemplateProcessor();
  const dropboxService = new DropboxService();

  // File upload endpoint
  app.post("/api/upload", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const fileData = insertUploadedFileSchema.parse({
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
      });

      const uploadedFile = await storage.createUploadedFile(fileData);

      // Parse Excel file
      const parsedData = await excelParser.parseFile(req.file.path);
      
      // Store parsed data in database
      for (const sheet of parsedData.sheets) {
        for (let i = 0; i < sheet.data.length; i++) {
          await storage.createExcelData({
            fileId: uploadedFile.id,
            sheetName: sheet.name,
            rowIndex: i,
            data: sheet.data[i],
          });
        }
      }

      res.json({
        file: uploadedFile,
        preview: {
          sheets: parsedData.sheets.map(sheet => ({
            name: sheet.name,
            rowCount: sheet.data.length,
            columns: sheet.columns,
            sampleData: sheet.data.slice(0, 5), // First 5 rows for preview
          }))
        }
      });
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Upload failed" });
    }
  });

  // Start processing endpoint
  app.post("/api/process", async (req, res) => {
    try {
      const { fileId, templateType } = req.body;

      if (!fileId || !templateType) {
        return res.status(400).json({ message: "fileId and templateType are required" });
      }

      const jobData = insertProcessingJobSchema.parse({
        fileId,
        templateType,
        status: "pending",
        progress: 0,
      });

      const job = await storage.createProcessingJob(jobData);

      // Start background processing
      processFileAsync(job.id, excelParser, templateProcessor, dropboxService);

      res.json({ jobId: job.id });
    } catch (error) {
      console.error("Processing error:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Processing failed" });
    }
  });

  // Get processing status
  app.get("/api/process/:jobId", async (req, res) => {
    try {
      const jobId = parseInt(req.params.jobId);
      const job = await storage.getProcessingJob(jobId);

      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      res.json(job);
    } catch (error) {
      console.error("Status check error:", error);
      res.status(500).json({ message: "Failed to get status" });
    }
  });

  // Download processed file
  app.get("/api/download/:jobId", async (req, res) => {
    try {
      const jobId = parseInt(req.params.jobId);
      const job = await storage.getProcessingJob(jobId);

      if (!job || !job.resultFilePath) {
        return res.status(404).json({ message: "File not found" });
      }

      const filePath = path.join(process.cwd(), job.resultFilePath);
      
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "File not found on disk" });
      }

      res.download(filePath);
    } catch (error) {
      console.error("Download error:", error);
      res.status(500).json({ message: "Download failed" });
    }
  });

  // Get recent processing history
  app.get("/api/history", async (req, res) => {
    try {
      const history = await storage.getRecentProcessingJobs(10);
      res.json(history);
    } catch (error) {
      console.error("History error:", error);
      res.status(500).json({ message: "Failed to get history" });
    }
  });

  // Export to Dropbox
  app.post("/api/export-dropbox/:jobId", async (req, res) => {
    try {
      const jobId = parseInt(req.params.jobId);
      const job = await storage.getProcessingJob(jobId);

      if (!job || !job.resultFilePath) {
        return res.status(404).json({ message: "Job or file not found" });
      }

      const { folder = "Reports" } = req.body;
      
      const success = await dropboxService.uploadFile(
        job.resultFilePath,
        `/${folder}/${path.basename(job.resultFilePath)}`
      );

      if (success) {
        await storage.updateProcessingJob(jobId, { dropboxExported: true });
        res.json({ success: true });
      } else {
        res.status(500).json({ message: "Dropbox export failed" });
      }
    } catch (error) {
      console.error("Dropbox export error:", error);
      res.status(500).json({ message: "Export failed" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Background processing function
async function processFileAsync(
  jobId: number,
  excelParser: ExcelParser,
  templateProcessor: TemplateProcessor,
  dropboxService: DropboxService
) {
  try {
    await storage.updateProcessingJob(jobId, { status: "processing", progress: 20 });

    const job = await storage.getProcessingJob(jobId);
    if (!job) return;

    // Get Excel data
    const excelData = await storage.getExcelDataByFileId(job.fileId);
    await storage.updateProcessingJob(jobId, { progress: 40 });

    // Process template
    const outputPath = await templateProcessor.processTemplate(
      job.templateType,
      excelData,
      job.fileId
    );
    await storage.updateProcessingJob(jobId, { progress: 80 });

    // Complete job
    await storage.updateProcessingJob(jobId, {
      status: "completed",
      progress: 100,
      resultFilePath: outputPath,
      completedAt: new Date(),
    });

    // Auto-export to Dropbox if configured
    // This would be configurable in a real app
    try {
      await dropboxService.uploadFile(outputPath, `/Reports/${path.basename(outputPath)}`);
      await storage.updateProcessingJob(jobId, { dropboxExported: true });
    } catch (dropboxError) {
      console.error("Auto-export to Dropbox failed:", dropboxError);
    }

  } catch (error) {
    console.error("Processing failed:", error);
    await storage.updateProcessingJob(jobId, {
      status: "failed",
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
