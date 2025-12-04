import type { Express } from "express";
import { createServer, type Server } from "http";
import authRoutes from "./auth/routes.js";
import userRoutes from "./auth/userRoutes.js";
import dispatchSessionRoutes from "./routes/dispatch-sessions.js";
import { authenticateToken } from "./auth/middleware.js";
import { 
  requireAuth, 
  requireDispatchAccess, 
  requireDispatchEdit,
  requireEODAccess,
  requireEODEdit,
  requirePAXAccess,
  requirePAXEdit,
  requireTemplateAccess,
  requireTemplateEdit
} from "./auth/roleMiddleware.js";
import { storage } from "./storage.js";
import multer from "multer";
import path from "path";
import fs from "fs";
import { ExcelParser } from "./services/excel-parser.js";
import { TemplateProcessor } from "./services/template-processor.js";
import { DropboxService } from "./services/dropbox-service.js";
import { EODProcessor } from "./services/eod-processor-exceljs.js";
import { DispatchGenerator } from "./services/dispatch-generator.js";
import { simpleEODProcessor } from "./services/simple-eod-processor.js";
import { cellExtractor } from "./services/cell-extractor.js";
import { PaxProcessor } from "./services/pax-processor.js";
import { ConsolidatedPaxProcessor } from "./services/consolidated-pax-processor.js";
import { blobStorage } from "./services/blob-storage.js";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import { 
  insertUploadedFileSchema, 
  insertProcessingJobSchema, 
  insertDispatchTemplateSchema,
  insertEodTemplateSchema,
  insertPaxTemplateSchema,
  insertDispatchRecordSchema
} from "../shared/schema.js";

// On Vercel, use memory storage and write to /tmp (writable directory)
// Locally, use disk storage for persistence
const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV;

const upload = multer({ 
  storage: isVercel 
    ? multer.memoryStorage() // Use memory storage on Vercel
    : multer.diskStorage({
    destination: function(req, file, cb) {
      // Use ship-specific directory
      const shipId = req.body.shipId || 'ship-a';
      const uploadDir = path.join('uploads', shipId);
      
      // Ensure directory exists
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      
      cb(null, uploadDir);
    },
    filename: function(req, file, cb) {
      // Keep original filename structure but ensure uniqueness
      const timestamp = Date.now();
      const ext = path.extname(file.originalname);
      const name = path.basename(file.originalname, ext);
      cb(null, `${name}_${timestamp}${ext}`);
    }
  }),
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
  const eodProcessor = new EODProcessor();
  const dispatchGenerator = new DispatchGenerator();
  const paxProcessor = new PaxProcessor();
  const consolidatedPaxProcessor = new ConsolidatedPaxProcessor();

  // Authentication routes
  app.use("/api/auth", authRoutes);
  
  // User management routes  
  app.use("/api/users", userRoutes);

  // Dispatch session management routes
  app.use("/api/dispatch-sessions", dispatchSessionRoutes);

  // Initialize default superuser if none exists (non-blocking)
  const userService = await import("./services/userService.js");
  const userServiceInstance = new userService.UserService();
  userServiceInstance.createDefaultSuperuser().catch((error) => {
    console.error("Failed to create default superuser:", error);
    // Don't throw - allow app to continue even if superuser creation fails
  });

  // Helper function to handle file download (blob URL or filesystem)
  async function handleFileDownload(filePathOrUrl: string, res: Express.Response, filename?: string, forceDownload: boolean = true): Promise<void> {
    // Check if it's a blob URL
    if (blobStorage.isBlobUrl(filePathOrUrl)) {
      try {
        // For downloads, proxy through server to ensure proper headers
        // For views, we can redirect to CDN for better performance
        if (forceDownload) {
          console.log(`→ Downloading from blob URL (proxying): ${filePathOrUrl}`);
          const buffer = await blobStorage.downloadFile(filePathOrUrl);
          
          if (!res.headersSent) {
            // Set appropriate headers for Excel files
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            if (filename) {
              res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            }
            
            res.send(buffer);
          }
        } else {
          // For viewing, redirect to CDN (faster)
          if (!res.headersSent) {
            console.log(`→ Redirecting to blob URL: ${filePathOrUrl}`);
            res.redirect(302, filePathOrUrl);
          }
        }
        return;
      } catch (error) {
        console.error(`→ Failed to download from blob URL: ${error}`);
        if (!res.headersSent) {
          res.status(500).json({ 
            message: "Failed to download file from blob storage",
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
        return;
      }
    }

    // For filesystem paths, check if file exists and serve it
    let filePath = filePathOrUrl;
    if (!path.isAbsolute(filePath)) {
      filePath = path.join(process.cwd(), filePath);
    }
      
    if (!fs.existsSync(filePath)) {
      console.log(`→ File not found on filesystem: ${filePath}`);
      if (!res.headersSent) {
        res.status(404).json({ message: "File not found" });
      }
      return;
    }

    if (!res.headersSent) {
      // Set appropriate headers for Excel files
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      if (filename) {
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      }
      
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    }
  }

  // Serve uploaded files - ship-aware
  app.get("/api/files/:shipId/:filename", async (req, res) => {
    try {
      const { shipId, filename } = req.params;
      
      // First, try to find the file in the database templates (might be stored in blob storage)
      // Check if this filename matches any active template
      try {
        const dispatchTemplate = await storage.getActiveDispatchTemplate(shipId);
        if (dispatchTemplate?.filePath && (dispatchTemplate.filename === filename || dispatchTemplate.filePath.includes(filename))) {
          console.log(`→ Found dispatch template in database: ${dispatchTemplate.filePath}`);
          await handleFileDownload(dispatchTemplate.filePath, res, dispatchTemplate.originalFilename || filename);
          return;
        }
      } catch (error) {
        // Continue to next check
      }

      try {
        const eodTemplate = await storage.getActiveEodTemplate(shipId);
        if (eodTemplate?.filePath && (eodTemplate.filename === filename || eodTemplate.filePath.includes(filename))) {
          console.log(`→ Found EOD template in database: ${eodTemplate.filePath}`);
          await handleFileDownload(eodTemplate.filePath, res, eodTemplate.originalFilename || filename);
          return;
        }
      } catch (error) {
        // Continue to next check
      }

      try {
        const paxTemplate = await storage.getActivePaxTemplate(shipId);
        if (paxTemplate?.filePath && (paxTemplate.filename === filename || paxTemplate.filePath.includes(filename))) {
          console.log(`→ Found PAX template in database: ${paxTemplate.filePath}`);
          await handleFileDownload(paxTemplate.filePath, res, paxTemplate.originalFilename || filename);
          return;
        }
      } catch (error) {
        // Continue to filesystem lookup
      }

      // Fallback to filesystem lookup
      const filePath = path.join(process.cwd(), "uploads", shipId, filename);
      await handleFileDownload(filePath, res, filename);
    } catch (error) {
      console.error("File serving error:", error);
      res.status(500).json({ message: "Failed to serve file" });
    }
  });

  // Legacy file serving (backwards compatibility)
  app.get("/api/files/:filename", async (req, res) => {
    try {
      const { filename } = req.params;
      
      // First, try to find in database templates (ship-a default)
      try {
        const dispatchTemplate = await storage.getActiveDispatchTemplate('ship-a');
        if (dispatchTemplate?.filePath && (dispatchTemplate.filename === filename || dispatchTemplate.filePath.includes(filename))) {
          await handleFileDownload(dispatchTemplate.filePath, res, dispatchTemplate.originalFilename || filename);
          return;
        }
      } catch (error) {
        // Continue to filesystem lookup
      }

      // Try ship-a first for backwards compatibility
      let filePath = path.join(process.cwd(), "uploads", "ship-a", filename);
      
      if (!fs.existsSync(filePath)) {
        // Fallback to root uploads directory
        filePath = path.join(process.cwd(), "uploads", filename);
      }
      
      await handleFileDownload(filePath, res, filename);
    } catch (error) {
      console.error("File serving error:", error);
      res.status(500).json({ message: "Failed to serve file" });
    }
  });

  // Serve output files (generated reports) - ship-aware with path or query parameter
  app.get("/api/output/:shipOrFilename/:filename?", async (req, res) => {
    try {
      let filename, shipId;
      
      if (req.params.filename) {
        // Ship-specific path: /api/output/ship-a/filename.xlsx
        shipId = req.params.shipOrFilename;
        filename = req.params.filename;
      } else {
        // Query parameter format: /api/output/filename.xlsx?ship=ship-a
        filename = req.params.shipOrFilename;
        shipId = req.query.ship as string;
      }
      
      let filePathOrUrl: string | undefined;
      
      // Check if this is a consolidated PAX file request
      if (shipId === 'consolidated' && req.params.filename) {
        // Consolidated PAX path: /api/output/consolidated/pax/filename.xlsx
        const consolidatedType = req.params.filename; // Should be 'pax'
        const actualFilename = req.query.file as string;
        
        if (consolidatedType === 'pax' && actualFilename) {
          // First check if this is a blob URL stored in database (check generated reports)
          try {
            const recentReports = await storage.getRecentGeneratedReports(10);
            const report = recentReports.find(r => 
              r.eodFilePath && (r.eodFilePath.includes(actualFilename) || path.basename(r.eodFilePath) === actualFilename)
            );
            if (report?.eodFilePath && blobStorage.isBlobUrl(report.eodFilePath)) {
              filePathOrUrl = report.eodFilePath;
            }
          } catch (error) {
            console.log(`→ Consolidated PAX database lookup failed: ${error}`);
          }
          
          // Fallback to filesystem
          if (!filePathOrUrl) {
            filePathOrUrl = path.join(process.cwd(), "output", "consolidated", "pax", actualFilename);
          }
        } else {
          return res.status(400).json({ message: "Invalid consolidated file request. Use format: /api/output/consolidated/pax?file=filename.xlsx" });
        }
      } else if (shipId) {
        // Ship-specific path - check database for blob URLs first
        try {
          // Check dispatch versions (for saved dispatch sheets)
          const dispatchVersions = await storage.getDispatchVersions(shipId, 10);
          const version = dispatchVersions.find(v => 
            v.filePath && (v.filePath.includes(filename) || path.basename(v.filePath) === filename)
          );
          if (version?.filePath && blobStorage.isBlobUrl(version.filePath)) {
            filePathOrUrl = version.filePath;
          }
        } catch (error) {
          console.log(`→ Dispatch version lookup failed: ${error}`);
        }
        
        // Check generated reports
        if (!filePathOrUrl) {
          try {
            const recentReports = await storage.getRecentGeneratedReports(10, shipId);
            const report = recentReports.find(r => 
              (r.dispatchFilePath && (r.dispatchFilePath.includes(filename) || path.basename(r.dispatchFilePath) === filename)) ||
              (r.eodFilePath && (r.eodFilePath.includes(filename) || path.basename(r.eodFilePath) === filename))
            );
            if (report) {
              filePathOrUrl = report.dispatchFilePath?.includes(filename) ? report.dispatchFilePath : report.eodFilePath;
            }
          } catch (error) {
            console.log(`→ Generated report lookup failed: ${error}`);
          }
        }
        
        // Fallback to filesystem
        if (!filePathOrUrl) {
          filePathOrUrl = path.join(process.cwd(), "output", shipId, filename);
        }
      } else {
        // Legacy path for backwards compatibility
        filePathOrUrl = path.join(process.cwd(), "output", filename);
      }
      
      await handleFileDownload(filePathOrUrl, res, filename);
    } catch (error) {
      console.error("Output file serving error:", error);
      res.status(500).json({ message: "Failed to serve output file" });
    }
  });

  // File upload endpoint - ship-aware (requires dispatch access)
  app.post("/api/upload", 
    authenticateToken, 
    requireDispatchAccess, 
    upload.single("file"), 
    async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const shipId = req.body.shipId || 'ship-a';
      const { key: blobKey, filename: generatedFilename } = buildBlobKey({
        category: "uploads",
        shipId,
        originalFilename: req.file.originalname || req.file.filename,
        fallbackPrefix: "dispatch",
      });
      const storedFilename = req.file.filename || generatedFilename;
      req.file.filename = storedFilename;

      let fileBuffer: Buffer;
      try {
        fileBuffer = getUploadedFileBuffer(req.file);
      } catch (error) {
        console.error("Failed to read uploaded file buffer:", error);
        return res.status(500).json({ message: "Unable to read uploaded file" });
      }

      let blobUrl: string | undefined;
      try {
        const uploadResult = await blobStorage.uploadFile(
          fileBuffer,
          blobKey,
          req.file.mimetype || "application/octet-stream",
          false
        );
        blobUrl = uploadResult.url;
      } catch (error) {
        console.warn("Blob upload failed; falling back to local storage path:", error);
      }

      const fileData = insertUploadedFileSchema.parse({
        filename: storedFilename,
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
      });

      const uploadedFile = await storage.createUploadedFile(fileData);

      // Handle memory storage (Vercel) vs disk storage (local)
      let filePath: string;
      if ((req.file as any).buffer) {
        // Memory storage - write to /tmp first, then read
        const tmpDir = path.join('/tmp', 'uploads', shipId);
        if (!fs.existsSync(tmpDir)) {
          fs.mkdirSync(tmpDir, { recursive: true });
        }
        filePath = path.join(tmpDir, req.file.filename);
        fs.writeFileSync(filePath, (req.file as any).buffer);
      } else {
        // Disk storage - use existing path
        filePath = req.file.path;
      }

      // Parse Excel file from ship-specific directory
      const parsedData = await excelParser.parseFile(filePath);
      
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

      console.log(`Parsed data for ${shipId}:`, JSON.stringify({
        sheets: parsedData.sheets.map(sheet => ({
          name: sheet.name,
          rowCount: sheet.data.length,
          columns: sheet.columns,
          sampleData: sheet.data.slice(0, 3)
        }))
      }, null, 2));

      // Create a ship-aware dispatch version record
      const versionCount = await storage.getDispatchVersions(100, shipId);
      const nextVersion = versionCount.length + 1;
      
      await storage.createDispatchVersion({
        filename: uploadedFile.filename,
        originalFilename: uploadedFile.originalName,
        filePath: blobUrl ?? filePath,
        shipId: shipId,
        version: nextVersion,
        description: `Edited dispatch sheet v${nextVersion} for ${shipId}`,
      });

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

  // Start processing endpoint (requires dispatch edit access)
  app.post("/api/process", 
    authenticateToken, 
    requireDispatchEdit, 
    async (req, res) => {
    try {
      const { fileId, templateType, dispatchFileId, eodTemplateFileId } = req.body;

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

      // Start background processing with optional EOD template processing
      processFileAsync(job.id, excelParser, templateProcessor, dropboxService, eodProcessor, dispatchFileId, eodTemplateFileId).catch(console.error);

      res.json({ jobId: job.id });
    } catch (error) {
      console.error("Processing error:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Processing failed" });
    }
  });

  // Get processing status (requires dispatch access)
  app.get("/api/process/:jobId", 
    authenticateToken, 
    requireDispatchAccess, 
    async (req, res) => {
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

  // Download processed file (requires dispatch access)
  app.get("/api/download/:jobId", 
    authenticateToken, 
    requireDispatchAccess, 
    async (req, res) => {
    try {
      const jobId = parseInt(req.params.jobId);
      console.log('Requested job ID:', jobId);
      
      const job = await storage.getProcessingJob(jobId);
      console.log('Retrieved job:', job);
      
      if (!job) {
        console.log('Job not found in database');
        return res.status(404).json({ message: "Job not found" });
      }
      
      if (!job.resultFilePath) {
        console.log('Job found but no result file path');
        return res.status(404).json({ message: "File not found" });
      }

      // Handle blob URLs or filesystem paths
      const filePathOrUrl = job.resultFilePath;
      const filename = path.basename(filePathOrUrl);
      
      console.log(`Attempting to download file: ${filePathOrUrl}`);
      
      await handleFileDownload(filePathOrUrl, res, filename);
    } catch (error) {
      console.error("Download error:", error);
      res.status(500).json({ message: "Download failed" });
    }
  });

  // Get recent processing history (requires dispatch access)
  app.get("/api/history", 
    authenticateToken, 
    requireDispatchAccess, 
    async (req, res) => {
    try {
      const shipId = req.query.ship as string;
      const history = await storage.getRecentProcessingJobs(10, shipId);
      res.json(history);
    } catch (error) {
      console.error("History error:", error);
      res.status(500).json({ message: "Failed to get history" });
    }
  });

  // Processing jobs endpoint for ship-aware job listing
  app.get("/api/processing-jobs", async (req, res) => {
    try {
      const shipId = req.query.ship as string;
      const jobs = await storage.getRecentProcessingJobs(10, shipId);
      res.json(jobs.map(job => ({
        id: job.id,
        status: job.status,
        templateType: job.templateType,
        outputPath: job.resultFilePath,
        createdAt: job.createdAt,
        shipId: job.shipId
      })));
    } catch (error) {
      console.error("Processing jobs fetch error:", error);
      res.status(500).json({ message: "Failed to fetch processing jobs" });
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

  // Helper function to handle file upload path (memory storage on Vercel vs disk storage locally)
  function getUploadedFilePath(req: Express.Request, shipId: string): string {
    const file = (req as any).file;
    
    if (file.buffer) {
      // Memory storage - write to /tmp (Vercel writable directory)
      const timestamp = Date.now();
      const ext = path.extname(file.originalname);
      const name = path.basename(file.originalname, ext);
      const filename = `${name}_${timestamp}${ext}`;
      
      // Ensure /tmp directory exists and create ship-specific subdirectory
      const tmpDir = path.join('/tmp', 'uploads', shipId);
      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
      }
      
      const filePath = path.join(tmpDir, filename);
      fs.writeFileSync(filePath, file.buffer);
      
      console.log(`File saved to /tmp: ${filePath}`);
      return filePath;
    } else {
      // Disk storage - use existing path
      return file.path;
    }
  }

  function getUploadedFileBuffer(file: Express.Multer.File): Buffer {
    if ((file as any).buffer) {
      return Buffer.from((file as any).buffer);
    }
    if (file.path && fs.existsSync(file.path)) {
      return fs.readFileSync(file.path);
    }
    throw new Error("Uploaded file buffer is not available");
  }

  function buildBlobKey(options: {
    category: string;
    shipId?: string;
    originalFilename?: string;
    fallbackPrefix: string;
  }): { key: string; filename: string } {
    const { category, shipId, originalFilename, fallbackPrefix } = options;
    const ext = path.extname(originalFilename || "") || ".xlsx";
    const rawBase = originalFilename ? path.basename(originalFilename, ext) : fallbackPrefix;
    const safeBase = (rawBase || fallbackPrefix).replace(/[^a-zA-Z0-9-_]/g, "_");
    const filename = `${safeBase}_${Date.now()}${ext}`;
    const segments = [category];
    if (shipId) {
      segments.push(shipId);
    }
    segments.push(filename);
    return { key: segments.join("/"), filename };
  }

  // Template management routes
  app.post("/api/templates/dispatch", upload.single("template"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No template file provided" });
      }

      // Extract ship ID from request body or default to ship-a
      const shipId = req.body.shipId || 'ship-a';

      const { key: blobKey, filename: generatedFilename } = buildBlobKey({
        category: "templates/dispatch",
        shipId,
        originalFilename: req.file.originalname || req.file.filename,
        fallbackPrefix: "dispatch_template",
      });
      const storedFilename = req.file.filename || generatedFilename;
      req.file.filename = storedFilename;

      let fileBuffer: Buffer;
      try {
        fileBuffer = getUploadedFileBuffer(req.file);
      } catch (error) {
        console.error("Failed to read dispatch template buffer:", error);
        return res.status(500).json({ message: "Unable to read template file" });
      }

      let blobUrl: string | undefined;
      try {
        const uploadResult = await blobStorage.uploadFile(
          fileBuffer,
          blobKey,
          req.file.mimetype || "application/octet-stream",
          false
        );
        blobUrl = uploadResult.url;
      } catch (error) {
        console.warn("Blob upload failed for dispatch template; using local path fallback:", error);
      }

      const filePath = getUploadedFilePath(req, shipId);

      const templateData = insertDispatchTemplateSchema.parse({
        filename: storedFilename,
        originalFilename: req.file.originalname,
        filePath: blobUrl ?? filePath,
        shipId: shipId,
      });

      const template = await storage.createDispatchTemplate(templateData);
      res.json(template);
    } catch (error) {
      console.error("Dispatch template upload error:", error);
      res.status(500).json({ 
        message: "Template upload failed",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.post("/api/templates/eod", upload.single("template"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No template file provided" });
      }

      // Extract ship ID from request body or default to ship-a
      const shipId = req.body.shipId || 'ship-a';

      const { key: blobKey, filename: generatedFilename } = buildBlobKey({
        category: "templates/eod",
        shipId,
        originalFilename: req.file.originalname || req.file.filename,
        fallbackPrefix: "eod_template",
      });
      const storedFilename = req.file.filename || generatedFilename;
      req.file.filename = storedFilename;

      let fileBuffer: Buffer;
      try {
        fileBuffer = getUploadedFileBuffer(req.file);
      } catch (error) {
        console.error("Failed to read EOD template buffer:", error);
        return res.status(500).json({ message: "Unable to read template file" });
      }

      let blobUrl: string | undefined;
      try {
        const uploadResult = await blobStorage.uploadFile(
          fileBuffer,
          blobKey,
          req.file.mimetype || "application/octet-stream",
          false
        );
        blobUrl = uploadResult.url;
      } catch (error) {
        console.warn("Blob upload failed for EOD template; using local path fallback:", error);
      }

      const filePath = getUploadedFilePath(req, shipId);

      const templateData = insertEodTemplateSchema.parse({
        filename: storedFilename,
        originalFilename: req.file.originalname,
        filePath: blobUrl ?? filePath,
        shipId: shipId,
      });

      const template = await storage.createEodTemplate(templateData);
      res.json(template);
    } catch (error) {
      console.error("EOD template upload error:", error);
      res.status(500).json({ 
        message: "Template upload failed",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.post("/api/templates/pax", upload.single("template"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No template file provided" });
      }

      // Extract ship ID from request body or default to ship-a
      const shipId = req.body.shipId || 'ship-a';

      const { key: blobKey, filename: generatedFilename } = buildBlobKey({
        category: "templates/pax",
        shipId,
        originalFilename: req.file.originalname || req.file.filename,
        fallbackPrefix: "pax_template",
      });
      const storedFilename = req.file.filename || generatedFilename;
      req.file.filename = storedFilename;

      let fileBuffer: Buffer;
      try {
        fileBuffer = getUploadedFileBuffer(req.file);
      } catch (error) {
        console.error("Failed to read PAX template buffer:", error);
        return res.status(500).json({ message: "Unable to read template file" });
      }

      let blobUrl: string | undefined;
      try {
        const uploadResult = await blobStorage.uploadFile(
          fileBuffer,
          blobKey,
          req.file.mimetype || "application/octet-stream",
          false
        );
        blobUrl = uploadResult.url;
      } catch (error) {
        console.warn("Blob upload failed for PAX template; using local path fallback:", error);
      }

      const filePath = getUploadedFilePath(req, shipId);

      const templateData = insertPaxTemplateSchema.parse({
        filename: storedFilename,
        originalFilename: req.file.originalname,
        filePath: blobUrl ?? filePath,
        shipId: shipId,
      });

      const template = await storage.createPaxTemplate(templateData);
      res.json(template);
    } catch (error) {
      console.error("PAX template upload error:", error);
      res.status(500).json({ 
        message: "Template upload failed",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Get template status (ship-aware)
  app.get("/api/templates/status", async (req, res) => {
    try {
      const shipId = req.query.ship as string;
      const dispatchTemplate = await storage.getActiveDispatchTemplate(shipId);
      const eodTemplate = await storage.getActiveEodTemplate(shipId);
      const paxTemplate = await storage.getActivePaxTemplate(shipId);
      
      res.json({
        dispatch: dispatchTemplate,
        eod: eodTemplate,
        pax: paxTemplate,
        hasTemplates: !!(dispatchTemplate && eodTemplate && paxTemplate),
        ship: shipId || 'ship-a'
      });
    } catch (error) {
      console.error("Template status error:", error);
      res.status(500).json({ message: "Failed to get template status" });
    }
  });

  // Get dispatch templates (ship-aware)
  app.get("/api/dispatch-templates", async (req, res) => {
    try {
      const shipId = req.query.ship as string;
      const template = await storage.getActiveDispatchTemplate(shipId);
      console.log(`Dispatch template query result for ship ${shipId || 'default'}:`, template);
      res.json(template || {});
    } catch (error) {
      console.error("Dispatch template fetch error:", error);
      res.status(500).json({ message: "Failed to fetch dispatch template" });
    }
  });

  // Get EOD templates (ship-aware)
  app.get("/api/eod-templates", async (req, res) => {
    try {
      const shipId = req.query.ship as string;
      const template = await storage.getActiveEodTemplate(shipId);
      console.log(`EOD template query result for ship ${shipId || 'default'}:`, template);
      res.json(template || {});
    } catch (error) {
      console.error("EOD template fetch error:", error);
      res.status(500).json({ message: "Failed to fetch EOD template" });
    }
  });

  // Download dispatch template (ship-aware)
  app.get("/api/templates/dispatch/download", async (req, res) => {
    try {
      const shipId = req.query.ship as string;
      console.log(`→ Download dispatch template requested for ship: ${shipId || 'default'}`);
      
      const template = await storage.getActiveDispatchTemplate(shipId);
      console.log(`→ Template lookup result:`, template ? { id: template.id, filename: template.filename, hasFilePath: !!template.filePath } : 'null');
      
      if (!template) {
        console.log(`→ No template found for ship ${shipId || 'default'}`);
        return res.status(404).json({ message: `Dispatch template not found for ${shipId || 'default ship'}` });
      }
      
      if (!template.filePath) {
        console.log(`→ Template found but filePath is null/undefined`);
        return res.status(404).json({ message: `Template file path not available` });
      }

      console.log(`→ Downloading template from: ${template.filePath}`);
      await handleFileDownload(template.filePath, res, template.originalFilename || "dispatch_template.xlsx");
    } catch (error) {
      console.error("Dispatch template download error:", error);
      if (!res.headersSent) {
        res.status(500).json({ message: "Failed to download dispatch template", error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  // Download EOD template (ship-aware)
  app.get("/api/templates/eod/download", async (req, res) => {
    try {
      const shipId = req.query.ship as string;
      const template = await storage.getActiveEodTemplate(shipId);
      if (!template || !template.filePath) {
        return res.status(404).json({ message: `EOD template not found for ${shipId || 'default ship'}` });
      }

      await handleFileDownload(template.filePath, res, template.originalFilename || "eod_template.xlsx");
    } catch (error) {
      console.error("EOD template download error:", error);
      res.status(500).json({ message: "Failed to download EOD template" });
    }
  });

  // Create dispatch template from already uploaded file
  app.post("/api/templates/dispatch/create", async (req, res) => {
    try {
      const templateData = insertDispatchTemplateSchema.parse(req.body);
      const template = await storage.createDispatchTemplate(templateData);
      res.json(template);
    } catch (error) {
      console.error("Dispatch template creation error:", error);
      res.status(500).json({ message: "Failed to create dispatch template" });
    }
  });

  // Create EOD template from already uploaded file
  app.post("/api/templates/eod/create", async (req, res) => {
    try {
      const templateData = insertEodTemplateSchema.parse(req.body);
      const template = await storage.createEodTemplate(templateData);
      res.json(template);
    } catch (error) {
      console.error("EOD template creation error:", error);
      res.status(500).json({ message: "Failed to create EOD template" });
    }
  });

  // Get PAX templates
  // Get PAX templates (ship-aware)
  app.get("/api/pax-templates", async (req, res) => {
    try {
      const shipId = req.query.ship as string;
      const template = await storage.getActivePaxTemplate(shipId);
      console.log(`PAX template query result for ship ${shipId || 'default'}:`, template);
      res.json(template || {});
    } catch (error) {
      console.error("PAX template fetch error:", error);
      res.status(500).json({ message: "Failed to fetch PAX template" });
    }
  });

  // Download PAX template (ship-aware)
  app.get("/api/templates/pax/download", async (req, res) => {
    try {
      const shipId = req.query.ship as string;
      const template = await storage.getActivePaxTemplate(shipId);
      if (!template || !template.filePath) {
        return res.status(404).json({ message: `PAX template not found for ${shipId || 'default ship'}` });
      }

      await handleFileDownload(template.filePath, res, template.originalFilename || "pax_template.xlsx");
    } catch (error) {
      console.error("PAX template download error:", error);
      res.status(500).json({ message: "Failed to download PAX template" });
    }
  });

  // Create PAX template from already uploaded file
  app.post("/api/templates/pax/create", async (req, res) => {
    try {
      const templateData = insertPaxTemplateSchema.parse(req.body);
      const template = await storage.createPaxTemplate(templateData);
      res.json(template);
    } catch (error) {
      console.error("PAX template creation error:", error);
      res.status(500).json({ message: "Failed to create PAX template" });
    }
  });

  // Dispatch record management routes
  app.post("/api/dispatch-records", async (req, res) => {
    try {
      const recordData = insertDispatchRecordSchema.parse(req.body);
      const record = await storage.createDispatchRecord(recordData);
      
      // After creating record, generate updated reports
      await generateReportsFromRecords();
      
      res.json(record);
    } catch (error) {
      console.error("Dispatch record creation error:", error);
      res.status(500).json({ message: "Failed to create dispatch record" });
    }
  });

  app.get("/api/dispatch-records", async (req, res) => {
    try {
      const records = await storage.getAllActiveDispatchRecords();
      res.json(records);
    } catch (error) {
      console.error("Dispatch records fetch error:", error);
      res.status(500).json({ message: "Failed to fetch dispatch records" });
    }
  });

  app.get("/api/generated-reports", async (req, res) => {
    try {
      const shipId = req.query.ship as string;
      const reports = await storage.getRecentGeneratedReports(10, shipId);
      res.json(reports);
    } catch (error) {
      console.error("Generated reports fetch error:", error);
      res.status(500).json({ message: "Failed to fetch generated reports" });
    }
  });

  // Get dispatch versions - ship-aware
  app.get("/api/dispatch-versions", async (req, res) => {
    try {
      const shipId = req.query.ship as string;
      const versions = await storage.getDispatchVersions(20, shipId);
      res.json(versions);
    } catch (error) {
      console.error("Dispatch versions fetch error:", error);
      res.status(500).json({ message: "Failed to fetch dispatch versions" });
    }
  });

  // Get specific dispatch version
  app.get("/api/dispatch-versions/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const version = await storage.getDispatchVersion(parseInt(id));
      
      if (!version) {
        return res.status(404).json({ message: "Dispatch version not found" });
      }
      
      res.json(version);
    } catch (error) {
      console.error("Dispatch version fetch error:", error);
      res.status(500).json({ message: "Failed to fetch dispatch version" });
    }
  });

  // Save edited dispatch sheet with formatting preservation
  app.post("/api/save-dispatch-sheet", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      console.log(`Saving edited dispatch sheet: ${req.file.originalname}`);
      
      // Extract ship ID and selected ship name from request body or default to ship-a  
      const { shipId = 'ship-a', selectedShipName } = req.body;
      
      // Get the active dispatch template for the specific ship
      const dispatchTemplate = await storage.getActiveDispatchTemplate(shipId);
      if (!dispatchTemplate) {
        return res.status(404).json({ message: `No active dispatch template found for ${shipId}` });
      }

      const templateWorkbook = new ExcelJS.Workbook();
      if (dispatchTemplate.filePath && blobStorage.isBlobUrl(dispatchTemplate.filePath)) {
        const templateBuffer = await blobStorage.downloadFile(dispatchTemplate.filePath);
        await templateWorkbook.xlsx.load(templateBuffer);
      } else {
      const templatePath = path.resolve(dispatchTemplate.filePath);
      if (!fs.existsSync(templatePath)) {
        return res.status(404).json({ message: "Dispatch template file not found" });
        }
        await templateWorkbook.xlsx.readFile(templatePath);
      }

      const editedWorkbook = new ExcelJS.Workbook();
      let editedFileBuffer: Buffer;
      try {
        editedFileBuffer = getUploadedFileBuffer(req.file);
      } catch (error) {
        console.error("Failed to read edited dispatch sheet buffer:", error);
        return res.status(500).json({ message: "Unable to read uploaded dispatch sheet" });
      }
      await editedWorkbook.xlsx.load(editedFileBuffer);
      
      const templateWorksheet = templateWorkbook.getWorksheet(1);
      const editedWorksheet = editedWorkbook.getWorksheet(1);
      
      if (!templateWorksheet || !editedWorksheet) {
        return res.status(500).json({ message: "Unable to read worksheet data" });
      }

      console.log("Preserving formatting from template and copying edited data");
      
      // First, copy header data from rows 1-8 (NEW TEMPLATE: B1=Country, B2=Cruise, B3=Ship, B5=Date)
      for (let headerRow = 1; headerRow <= 8; headerRow++) {
        const editedHeaderRow = editedWorksheet.getRow(headerRow);
        const templateHeaderRow = templateWorksheet.getRow(headerRow);
        
        editedHeaderRow.eachCell((cell, colNumber) => {
          const targetCell = templateHeaderRow.getCell(colNumber);
          
          // NEW TEMPLATE STRUCTURE:
          // B1 = Country, B2 = Cruise Line, B3 = Ship Name, E3 = Port, B4 = Tour Operator, B5 = Date
          
          // Special handling for B3 (Ship Name) - use selected ship name if provided
          if (headerRow === 3 && colNumber === 2 && selectedShipName) {
            console.log(`→ Updating header cell B3 with selected ship name: "${selectedShipName}"`);
            targetCell.value = selectedShipName;
          } else {
            // Log important header cells for debugging
            if ((headerRow === 1 && colNumber === 2) || // B1 - Country
                (headerRow === 2 && colNumber === 2) || // B2 - Cruise Line
                (headerRow === 3 && colNumber === 2) || // B3 - Ship Name
                (headerRow === 5 && colNumber === 2)) { // B5 - Date
              console.log(`→ Updating header cell ${String.fromCharCode(64 + colNumber)}${headerRow} with: "${cell.value}"`);
            }
            
            // Copy the value from edited sheet to template
            targetCell.value = cell.value;
          }
        });
      }
      
      // CRITICAL: Break shared formula structure in column R (rows 11-15) BEFORE copying values
      // R11 is the master, R12-R15 are clones. We must break this structure first.
      // Set ALL cells in the range to null to break any shared formula structure
      for (let row = 11; row <= 15; row++) {
        const targetCell = templateWorksheet.getCell(row, 18); // Column R
        // Set to null to break shared formula structure - this will be overwritten with user values below
        targetCell.value = null;
      }
      
      // Now copy all data from edited sheet while preserving template formatting
      editedWorksheet.eachRow((row, rowNumber) => {
        if (rowNumber >= 9) { // Data rows start from row 9 (NEW TEMPLATE: row 9 is headers, row 10+ is data)
          row.eachCell((cell, colNumber) => {
            if (colNumber <= 18) { // Process columns A-R (including Q and R so manual totals are preserved)
              const templateCell = templateWorksheet.getCell(10, colNumber); // Use row 10 as formatting template (NEW TEMPLATE: first data row)
              const targetCell = templateWorksheet.getCell(rowNumber, colNumber);
              
              // Extract the actual value from the cell (handles formula objects by getting result)
              // This ensures we set plain values, not formula objects
              let valueToSet = cell.value;
              if (valueToSet && typeof valueToSet === 'object') {
                // If it's a formula object, extract the result (calculated value)
                if ('result' in valueToSet) {
                  valueToSet = valueToSet.result;
                } else if ('formula' in valueToSet) {
                  // If it has a formula but no result, use null
                  valueToSet = null;
                }
              }
              
              // Set the value - since we already broke shared formulas above, this is safe
              targetCell.value = valueToSet;
              
              // Preserve original template formatting (if template cell has formatting)
              if (templateCell.font) targetCell.font = { ...templateCell.font };
              if (templateCell.fill) targetCell.fill = { ...templateCell.fill };
              if (templateCell.border) targetCell.border = { ...templateCell.border };
              if (templateCell.alignment) targetCell.alignment = { ...templateCell.alignment };
              if (templateCell.numFmt) targetCell.numFmt = templateCell.numFmt;
            }
          });
        }
      });

      // Save the formatted file with a new filename in ship-specific directory
      const timestamp = Date.now();
      const newFilename = `edited_dispatch_${timestamp}.xlsx`;
      
      // On Vercel, use /tmp; locally use uploads directory
      let shipUploadDir: string;
      if (isVercel) {
        shipUploadDir = path.join('/tmp', 'uploads', shipId);
      } else {
        shipUploadDir = path.join(process.cwd(), "uploads", shipId);
      }
      
      const outputPath = path.join(shipUploadDir, newFilename);
      
      // Ensure ship-specific upload directory exists
      if (!fs.existsSync(shipUploadDir)) {
        fs.mkdirSync(shipUploadDir, { recursive: true });
      }
      
      const finalBuffer = Buffer.from(await templateWorkbook.xlsx.writeBuffer());
      fs.writeFileSync(outputPath, finalBuffer);

      const { key: blobKey } = buildBlobKey({
        category: "dispatch/versions",
        shipId,
        originalFilename: newFilename,
        fallbackPrefix: "edited_dispatch"
      });
      let blobUrl: string | undefined;
      try {
        const uploadResult = await blobStorage.uploadFile(
          finalBuffer,
          blobKey,
          req.file.mimetype || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          false
        );
        blobUrl = uploadResult.url;
      } catch (error) {
        console.warn("Blob upload failed for saved dispatch sheet; using local path fallback:", error);
      }
      
      // Create file record in database
      const fileData = insertUploadedFileSchema.parse({
        filename: newFilename,
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        size: finalBuffer.length,
      });

      const uploadedFile = await storage.createUploadedFile(fileData);

      // Create dispatch version record with ship ID
      const versionCount = await storage.getDispatchVersions(100, shipId);
      const nextVersion = versionCount.length + 1;
      
      await storage.createDispatchVersion({
        filename: newFilename,
        originalFilename: req.file.originalname,
        filePath: blobUrl ?? outputPath,
        shipId: shipId,
        version: nextVersion,
        description: `Formatted dispatch sheet v${nextVersion} (${shipId})`,
      });

      // Clean up the original uploaded file
      if (req.file.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
      }

      console.log(`Saved formatted dispatch sheet: ${newFilename}`);
      
      res.json({
        success: true,
        file: uploadedFile,
        message: "Dispatch sheet saved with formatting preserved"
      });

    } catch (error) {
      console.error("Save dispatch sheet error:", error);
      console.error("Error stack:", error instanceof Error ? error.stack : 'No stack trace');
      res.status(500).json({ 
        message: "Failed to save dispatch sheet with formatting",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Get all output files with metadata (ship-aware)
  app.get("/api/output-files", async (req, res) => {
    try {
      const shipId = req.query.ship as string || 'ship-a';
      const outputDir = path.join(process.cwd(), "output");
      
      if (!fs.existsSync(outputDir)) {
        return res.json([]);
      }

      let fileList: any[] = [];

      if (shipId === 'all') {
        // Return files from all ships
        const shipDirs = ['ship-a', 'ship-b', 'ship-c'];
        for (const ship of shipDirs) {
          const shipOutputDir = path.join(outputDir, ship);
          if (fs.existsSync(shipOutputDir)) {
            const shipFiles = fs.readdirSync(shipOutputDir).filter(file => file.endsWith('.xlsx'));
            const shipFileList = shipFiles.map(filename => {
              const filePath = path.join(shipOutputDir, filename);
              const stats = fs.statSync(filePath);
              
              // Parse filename to determine type
              const isEOD = filename.startsWith('eod_');
              const isDispatch = filename.startsWith('dispatch_');
              const isPAX = filename.startsWith('pax_');
              
              return {
                filename,
                ship: ship,
                type: isEOD ? 'EOD Report' : isDispatch ? 'Dispatch Report' : isPAX ? 'PAX Report' : 'Other',
                size: stats.size,
                createdAt: stats.birthtime,
                downloadUrl: `/api/output/${ship}/${filename}`
              };
            });
            fileList.push(...shipFileList);
          }
        }
        
        // Also include consolidated PAX files when showing all files
        const consolidatedPaxDir = path.join(outputDir, "consolidated", "pax");
        if (fs.existsSync(consolidatedPaxDir)) {
          const consolidatedFiles = fs.readdirSync(consolidatedPaxDir).filter(file => file.endsWith('.xlsx'));
          const consolidatedFileList = consolidatedFiles.map(filename => {
            const filePath = path.join(consolidatedPaxDir, filename);
            const stats = fs.statSync(filePath);
            
            return {
              filename,
              ship: 'consolidated',
              type: 'Consolidated PAX Report',
              size: stats.size,
              createdAt: stats.birthtime,
              downloadUrl: `/api/output/consolidated/pax?file=${filename}`
            };
          });
          fileList.push(...consolidatedFileList);
        }
      } else {
        // Return files for specific ship
        const shipOutputDir = path.join(outputDir, shipId);
        if (fs.existsSync(shipOutputDir)) {
          const files = fs.readdirSync(shipOutputDir).filter(file => file.endsWith('.xlsx'));
          
          fileList = files.map((filename: string) => {
            const filePath = path.join(shipOutputDir, filename);
            const stats = fs.statSync(filePath);
            
            // Parse filename to determine type
            const isEOD = filename.startsWith('eod_');
            const isDispatch = filename.startsWith('dispatch_');
            const isPAX = filename.startsWith('pax_');
            
            return {
              filename,
              ship: shipId,
              type: isEOD ? 'EOD Report' : isDispatch ? 'Dispatch Report' : isPAX ? 'PAX Report' : 'Other',
              size: stats.size,
              createdAt: stats.birthtime,
              downloadUrl: `/api/output/${shipId}/${filename}`
            };
          });
        }
      }

      // Sort by creation date, newest first
      fileList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      res.json(fileList);
    } catch (error) {
      console.error("Output files fetch error:", error);
      res.status(500).json({ message: "Failed to fetch output files" });
    }
  });

  // Debug route to examine dispatch file data
  app.post("/api/debug-dispatch-data", async (req, res) => {
    try {
      const { dispatchFileId } = req.body;
      
      if (!dispatchFileId) {
        return res.status(400).json({ message: "Dispatch file ID is required" });
      }

      // Get the most recent dispatch version (like the EOD processor does)
      const dispatchVersions = await storage.getDispatchVersions(1);
      let dispatchFilePath;
      
      if (dispatchVersions.length > 0) {
        const latestVersion = dispatchVersions[0];
        dispatchFilePath = latestVersion.filePath;
        console.log('Debug: Using latest dispatch version:', latestVersion.filename);
      } else {
        const dispatchFile = await storage.getUploadedFile(parseInt(dispatchFileId));
        if (!dispatchFile) {
          return res.status(404).json({ message: "Dispatch file not found" });
        }
        dispatchFilePath = path.join(process.cwd(), "uploads", dispatchFile.filename);
      }

      console.log('Debug: Reading file at path:', dispatchFilePath);
      console.log('Debug: File exists:', fs.existsSync(dispatchFilePath));

      // Use the same cell extractor that the EOD processor uses
      const extractedRecords = await cellExtractor.extractMultipleRecords(dispatchFilePath);
      
      // Also read the raw Excel data for comparison
      const workbook = XLSX.readFile(dispatchFilePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Get specific cells to debug
      const cellA8 = worksheet['A8'] ? worksheet['A8'].v : 'undefined';
      const cellB8 = worksheet['B8'] ? worksheet['B8'].v : 'undefined';
      const cellL8 = worksheet['L8'] ? worksheet['L8'].v : 'undefined';
      const cellM8 = worksheet['M8'] ? worksheet['M8'].v : 'undefined';
      const cellN8 = worksheet['N8'] ? worksheet['N8'].v : 'undefined';
      
      res.json({
        filePath: dispatchFilePath,
        fileExists: fs.existsSync(dispatchFilePath),
        extractedRecords: extractedRecords,
        rawCellData: {
          A8: cellA8,
          B8: cellB8,
          L8: cellL8,
          M8: cellM8,
          N8: cellN8
        },
        sheetName: sheetName,
        debugInfo: {
          totalSheets: workbook.SheetNames.length,
          sheetNames: workbook.SheetNames
        }
      });
    } catch (error) {
      console.error("Debug dispatch data error:", error);
      res.status(500).json({ message: "Failed to debug dispatch data", error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  // Process EOD report from dispatch file
  app.post("/api/process-eod-from-dispatch", async (req, res) => {
    try {
      const { dispatchFileId } = req.body;
      
      if (!dispatchFileId) {
        return res.status(400).json({ message: "Dispatch file ID is required" });
      }

      // Get the most recent dispatch version (edited file) instead of the original upload
      const dispatchVersions = await storage.getDispatchVersions(1);
      let dispatchFile;
      let dispatchFilePath;
      
      if (dispatchVersions.length > 0) {
        // Use the latest edited dispatch file
        const latestVersion = dispatchVersions[0];
        // The file path is already absolute, use it directly
        dispatchFilePath = latestVersion.filePath;
        console.log('Using latest dispatch version:', latestVersion.filename);
        console.log('Dispatch file path:', dispatchFilePath);
        
        // Create a temporary file object for compatibility
        dispatchFile = {
          id: parseInt(dispatchFileId),
          filename: latestVersion.filename,
          originalName: latestVersion.originalFilename,
          mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          size: blobStorage.isBlobUrl(dispatchFilePath) ? 0 : (fs.existsSync(dispatchFilePath) ? fs.statSync(dispatchFilePath).size : 0),
          uploadedAt: new Date()
        };
      } else {
        // Fallback to original uploaded file
        dispatchFile = await storage.getUploadedFile(parseInt(dispatchFileId));
        if (!dispatchFile) {
          return res.status(404).json({ message: "Dispatch file not found" });
        }
        dispatchFilePath = path.join(process.cwd(), "uploads", dispatchFile.filename);
      }
      
      console.log('Dispatch file object:', dispatchFile);

      // Extract ship ID from request body or default to ship-a
      const { shipId = 'ship-a' } = req.body;

      // Get active EOD template for the specific ship
      const eodTemplate = await storage.getActiveEodTemplate(shipId);
      if (!eodTemplate) {
        return res.status(400).json({ message: `No active EOD template found for ${shipId}` });
      }

      // Parse dispatch data (dispatchFilePath is already set above)
      // Only check filesystem existence if it's not a blob URL
      if (!blobStorage.isBlobUrl(dispatchFilePath)) {
        console.log('File exists:', fs.existsSync(dispatchFilePath));
      } else {
        console.log('Dispatch file is a blob URL:', dispatchFilePath);
      }
      const dispatchData = await excelParser.parseFile(dispatchFilePath);
      console.log('Dispatch data for EOD processing:', JSON.stringify({
        sheets: dispatchData.sheets.map(sheet => ({
          name: sheet.name,
          rowCount: sheet.data.length,
          columns: sheet.data.length > 0 ? Object.keys(sheet.data[0]) : [],
          firstRowSample: sheet.data.length > 0 ? sheet.data[0] : null
        }))
      }, null, 2));

      // Generate timestamp for unique filenames
      const timestamp = Date.now();
      
      // Process EOD template with multiple dispatch records (ship-aware)
      // On Vercel, use blob storage; locally use filesystem
      const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV;
      let eodOutputPath: string;
      
      if (isVercel) {
        // On Vercel, use blob storage - the service will handle saving
        // Pass a blob key instead of filesystem path
        eodOutputPath = `output/${shipId}/eod_${timestamp}.xlsx`;
      } else {
        // Local development - use filesystem
        const shipOutputDir = path.join(process.cwd(), "output", shipId);
        if (!fs.existsSync(shipOutputDir)) {
          fs.mkdirSync(shipOutputDir, { recursive: true });
        }
        eodOutputPath = path.join(shipOutputDir, `eod_${timestamp}.xlsx`);
      }
      
      // Use filePath as-is if it's a blob URL, otherwise make it absolute
      let eodTemplatePath = eodTemplate.filePath;
      console.log(`→ EOD template filePath from database: ${eodTemplatePath}`);
      console.log(`→ filePath type: ${typeof eodTemplatePath}`);
      console.log(`→ filePath starts with https://? ${eodTemplatePath?.startsWith('https://')}`);
      console.log(`→ Is blob URL? ${blobStorage.isBlobUrl(eodTemplatePath)}`);
      
      // CRITICAL: Check for blob URL BEFORE any path manipulation
      if (blobStorage.isBlobUrl(eodTemplatePath)) {
        console.log('→ Using blob URL for EOD template (passing as-is):', eodTemplatePath);
        // Do NOT modify blob URLs - pass them directly
      } else if (eodTemplatePath && typeof eodTemplatePath === 'string') {
        // Only join with cwd if it's a filesystem path
        if (!path.isAbsolute(eodTemplatePath)) {
          eodTemplatePath = path.join(process.cwd(), eodTemplatePath);
        }
        console.log('→ Using filesystem path for EOD template:', eodTemplatePath);
      } else {
        throw new Error(`Invalid EOD template filePath: ${eodTemplatePath}`);
      }
      
      console.log(`→ Final EOD template path being passed to processor: ${eodTemplatePath}`);
      
      const eodResult = await simpleEODProcessor.processMultipleRecords(
        eodTemplatePath,
        parseInt(dispatchFileId),
        dispatchFilePath,
        eodOutputPath,
        shipId
      );

      // Generate dispatch report as well - for now, just copy the original file to ship-specific directory
      // On Vercel, use blob storage; locally use filesystem
      let dispatchOutputPath: string;
      if (isVercel) {
        // On Vercel, copy to blob storage
        if (blobStorage.isBlobUrl(dispatchFilePath)) {
          // Already in blob storage, just use the same path
          dispatchOutputPath = dispatchFilePath;
        } else {
          // Download and upload to blob storage
          const dispatchBuffer = fs.readFileSync(dispatchFilePath);
          const blobKey = `output/${shipId}/dispatch_${timestamp}.xlsx`;
          const blobUrl = await blobStorage.uploadFile(dispatchBuffer, blobKey, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', false);
          dispatchOutputPath = blobUrl;
        }
      } else {
        // Local development - use filesystem
        const shipOutputDir = path.join(process.cwd(), "output", shipId);
        dispatchOutputPath = path.join(shipOutputDir, `dispatch_${timestamp}.xlsx`);
        
        // Handle dispatch file copy - check if it's a blob URL
        if (blobStorage.isBlobUrl(dispatchFilePath)) {
          // Download from blob and save to local output directory
          const dispatchBuffer = await blobStorage.downloadFile(dispatchFilePath);
          fs.writeFileSync(dispatchOutputPath, dispatchBuffer);
        } else {
          fs.copyFileSync(dispatchFilePath, dispatchOutputPath);
        }
      }

      // Create a new dispatch version record with ship ID
      const dispatchVersion = await storage.createDispatchVersion({
        filename: path.basename(dispatchFilePath),
        originalFilename: `dispatch_${timestamp}.xlsx`,
        filePath: dispatchFilePath,
        shipId: shipId
      });

      // Extract filename from result (could be blob URL or filesystem path)
      const eodFilename = blobStorage.isBlobUrl(eodResult)
        ? path.basename(eodResult.split('?')[0])
        : path.basename(eodResult);

      // Return success with ship-specific information
      res.json({
        success: true,
        dispatchFile: path.basename(dispatchOutputPath),
        eodFile: eodFilename,
        eodFilePath: eodResult, // Include full path/URL for blob storage
        shipId: shipId,
        message: `EOD report generated successfully for ${shipId}`,
        dispatchVersionId: dispatchVersion.id
      });

      // After EOD generation, trigger consolidated PAX generation
      try {
        console.log(`→ Triggering consolidated PAX generation after EOD completion for ${shipId}`);
        const consolidatedPaxTemplate = await templateProcessor.getConsolidatedPaxTemplatePath();
        const consolidatedResult = await consolidatedPaxProcessor.processConsolidatedPaxForSingleShip(
          consolidatedPaxTemplate,
          shipId,
          dispatchFilePath // Use current ship's dispatch file for individual data
        );
        
        console.log(`→ Consolidated PAX generated after EOD: ${consolidatedResult.filename}`);
        console.log(`→ Contributing ships: ${consolidatedResult.data.contributingShips.join(', ')}`);
        
        // Save consolidated PAX report to database
        try {
          // consolidatedResult.filename is either a blob URL (if blob storage) or just filename (if filesystem)
          const filePath = blobStorage.isBlobUrl(consolidatedResult.filename) 
            ? consolidatedResult.filename 
            : `output/consolidated/pax/${consolidatedResult.filename}`;
          const filename = blobStorage.isBlobUrl(consolidatedResult.filename)
            ? path.basename(consolidatedResult.filename.split('?')[0])
            : consolidatedResult.filename;
          
          const consolidatedPaxRecord = await storage.createConsolidatedPaxReport({
            filename: filename,
            filePath: filePath,
            contributingShips: consolidatedResult.data.contributingShips,
            totalRecordCount: consolidatedResult.data.totalRecordCount,
            lastUpdatedByShip: shipId
          });
          console.log(`→ Consolidated PAX (after EOD) saved to database with ID: ${consolidatedPaxRecord.id}`);
        } catch (dbError) {
          console.error('→ Failed to save consolidated PAX to database:', dbError);
        }
      } catch (consolidatedError) {
        console.error('→ Consolidated PAX generation failed after EOD:', consolidatedError);
        // Don't fail the EOD process if consolidated PAX fails
      }

    } catch (error) {
      console.error("EOD processing error:", error);
      res.status(500).json({ 
        message: "Failed to process EOD report",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Add successive dispatch entry to existing EOD report
  app.post("/api/add-successive-dispatch", async (req, res) => {
    try {
      const { dispatchFileId, existingEodFilename, shipId = 'ship-a' } = req.body;
      
      if (!dispatchFileId || !existingEodFilename) {
        return res.status(400).json({ message: "Dispatch file ID and existing EOD filename are required" });
      }

      // Get the most recent dispatch version (edited file) for the specific ship
      const dispatchVersions = await storage.getDispatchVersions(1, shipId);
      let dispatchFilePath;
      
      if (dispatchVersions.length > 0) {
        const latestVersion = dispatchVersions[0];
        dispatchFilePath = latestVersion.filePath;
        console.log(`Adding successive dispatch from latest version (${shipId}):`, latestVersion.filename);
      } else {
        return res.status(404).json({ message: "No dispatch versions found" });
      }

      // Find existing EOD file - check database first (might be blob URL), then filesystem
      let existingEodPath: string | undefined;
      
      // Check generated reports for EOD file
      try {
        const recentReports = await storage.getRecentGeneratedReports(50, shipId);
        const eodReport = recentReports.find(r => 
          r.eodFilePath && (r.eodFilePath.includes(existingEodFilename) || path.basename(r.eodFilePath) === existingEodFilename)
        );
        if (eodReport?.eodFilePath) {
          existingEodPath = eodReport.eodFilePath;
          console.log(`→ Found existing EOD file in database: ${existingEodPath}`);
        }
      } catch (error) {
        console.log(`→ Database lookup for EOD file failed: ${error}`);
      }
      
      // Fallback to filesystem if not found in database (only for local development)
      if (!existingEodPath) {
        const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV;
        if (isVercel) {
          // On Vercel, if not found in database, we can't access filesystem
          return res.status(404).json({ message: `Existing EOD file not found in database for ${shipId}: ${existingEodFilename}. Please generate a new EOD report first.` });
        } else {
          // Local development - try filesystem
          const shipOutputDir = path.join(process.cwd(), "output", shipId);
          existingEodPath = path.join(shipOutputDir, existingEodFilename);
          
          if (!fs.existsSync(existingEodPath)) {
            return res.status(404).json({ message: `Existing EOD file not found for ${shipId}: ${existingEodFilename}` });
          }
        }
      }

      // Update the existing EOD file in-place (don't create new files)
      const updatedEodPath = await simpleEODProcessor.addSuccessiveDispatchEntry(
        existingEodPath,
        dispatchFilePath,
        existingEodPath,  // Save back to the same file
        shipId
      );

      // Extract filename from result (could be blob URL or filesystem path)
      const eodFilename = blobStorage.isBlobUrl(updatedEodPath)
        ? path.basename(updatedEodPath.split('?')[0])
        : path.basename(updatedEodPath);

      res.json({
        success: true,
        eodFile: eodFilename,
        eodFilePath: updatedEodPath, // Include full path/URL for blob storage
        shipId: shipId,
        message: `Successive dispatch entry added successfully for ${shipId}`,
        originalEodFile: existingEodFilename
      });

      // After successive EOD update, trigger consolidated PAX generation
      try {
        console.log(`→ Triggering consolidated PAX generation after successive EOD update for ${shipId}`);
        const consolidatedPaxTemplate = await templateProcessor.getConsolidatedPaxTemplatePath();
        const consolidatedResult = await consolidatedPaxProcessor.processConsolidatedPax(
          consolidatedPaxTemplate,
          shipId // Triggered by successive EOD entry from specific ship
        );
        
        console.log(`→ Consolidated PAX generated after successive EOD: ${consolidatedResult.filename}`);
        console.log(`→ Contributing ships: ${consolidatedResult.data.contributingShips.join(', ')}`);
        
        // Save consolidated PAX report to database
        try {
          // consolidatedResult.filename is either a blob URL (if blob storage) or just filename (if filesystem)
          const filePath = blobStorage.isBlobUrl(consolidatedResult.filename) 
            ? consolidatedResult.filename 
            : `output/consolidated/pax/${consolidatedResult.filename}`;
          const filename = blobStorage.isBlobUrl(consolidatedResult.filename)
            ? path.basename(consolidatedResult.filename.split('?')[0])
            : consolidatedResult.filename;
          
          const consolidatedPaxRecord = await storage.createConsolidatedPaxReport({
            filename: filename,
            filePath: filePath,
            contributingShips: consolidatedResult.data.contributingShips,
            totalRecordCount: consolidatedResult.data.totalRecordCount,
            lastUpdatedByShip: shipId
          });
          console.log(`→ Consolidated PAX (after successive EOD) saved to database with ID: ${consolidatedPaxRecord.id}`);
        } catch (dbError) {
          console.error('→ Failed to save consolidated PAX to database:', dbError);
        }
      } catch (consolidatedError) {
        console.error('→ Consolidated PAX generation failed after successive EOD:', consolidatedError);
        // Don't fail the successive dispatch process if consolidated PAX fails
      }

    } catch (error) {
      console.error("Successive dispatch entry error:", error);
      res.status(500).json({ 
        message: "Failed to add successive dispatch entry", 
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Process PAX report from dispatch file
  app.post("/api/process-pax-from-dispatch", async (req, res) => {
    try {
      const { dispatchFileId, shipId = 'ship-a' } = req.body;
      
      if (!dispatchFileId) {
        return res.status(400).json({ message: "Dispatch file ID is required" });
      }

      // Get the most recent dispatch version (edited file) for the specific ship
      const dispatchVersions = await storage.getDispatchVersions(1, shipId);
      let dispatchFilePath;
      
      if (dispatchVersions.length > 0) {
        // Use the latest edited dispatch file
        const latestVersion = dispatchVersions[0];
        dispatchFilePath = latestVersion.filePath;
        console.log(`Using latest dispatch version for PAX (${shipId}):`, latestVersion.filename);
        console.log('Dispatch file path:', dispatchFilePath);
      } else {
        // Fallback to original uploaded file
        const dispatchFile = await storage.getUploadedFile(parseInt(dispatchFileId));
        if (!dispatchFile) {
          return res.status(404).json({ message: "Dispatch file not found" });
        }
        dispatchFilePath = path.join(process.cwd(), "uploads", dispatchFile.filename);
      }

      // Get active PAX template for the specific ship
      const paxTemplate = await storage.getActivePaxTemplate(shipId);
      if (!paxTemplate) {
        return res.status(400).json({ message: `No active PAX template found for ${shipId}` });
      }

      // Use filePath as-is if it's a blob URL, otherwise make it absolute
      let paxTemplatePath = paxTemplate.filePath;
      if (!blobStorage.isBlobUrl(paxTemplatePath)) {
        // Only join with cwd if it's a filesystem path
        if (!path.isAbsolute(paxTemplatePath)) {
          paxTemplatePath = path.join(process.cwd(), paxTemplatePath);
        }
        console.log('File exists:', fs.existsSync(paxTemplatePath));
      } else {
        console.log('Using blob URL for PAX template:', paxTemplatePath);
      }
      
      // Generate PAX report using PaxProcessor with ship ID
      const paxOutputFilename = await paxProcessor.processDispatchToPax(dispatchFilePath, paxTemplatePath, shipId);
      
      res.json({
        success: true,
        paxFile: paxOutputFilename,
        shipId: shipId,
        message: `PAX report generated successfully for ${shipId}`
      });

    } catch (error) {
      console.error("PAX processing error:", error);
      res.status(500).json({ 
        message: "Failed to process PAX report",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Generate new PAX report with consolidated PAX auto-generation (ship-aware)
  app.post("/api/generate-pax-report", async (req, res) => {
    try {
      const { dispatchFileId, shipId = 'ship-a' } = req.body;
      
      if (!dispatchFileId) {
        return res.status(400).json({ message: "Dispatch file ID is required" });
      }

      // Get the most recent dispatch version (edited file) for the specific ship
      const dispatchVersions = await storage.getDispatchVersions(1, shipId);
      let dispatchFilePath;
      
      if (dispatchVersions.length > 0) {
        // Use the latest edited dispatch file
        const latestVersion = dispatchVersions[0];
        dispatchFilePath = latestVersion.filePath;
        console.log(`Using latest dispatch version for new PAX (${shipId}):`, latestVersion.filename);
      } else {
        // Fallback to original uploaded file
        const dispatchFile = await storage.getUploadedFile(parseInt(dispatchFileId));
        if (!dispatchFile) {
          return res.status(404).json({ message: "Dispatch file not found" });
        }
        dispatchFilePath = path.join(process.cwd(), "uploads", dispatchFile.filename);
      }

      // Get active PAX template for the specific ship
      const paxTemplate = await storage.getActivePaxTemplate(shipId);
      if (!paxTemplate) {
        return res.status(400).json({ message: `No active PAX template found for ${shipId}` });
      }

      // Use filePath as-is if it's a blob URL, otherwise make it absolute
      let paxTemplatePath = paxTemplate.filePath;
      if (!blobStorage.isBlobUrl(paxTemplatePath)) {
        // Only join with cwd if it's a filesystem path
        if (!path.isAbsolute(paxTemplatePath)) {
          paxTemplatePath = path.join(process.cwd(), paxTemplatePath);
        }
      } else {
        console.log('Using blob URL for PAX template:', paxTemplatePath);
      }

      // Generate new PAX report using PaxProcessor with ship ID
      const paxOutputFilename = await paxProcessor.processDispatchToPax(dispatchFilePath, paxTemplatePath, shipId);

      // Auto-generate consolidated PAX report
      try {
        const consolidatedProcessor = new ConsolidatedPaxProcessor();
        const templateProcessor = new TemplateProcessor();
        const consolidatedPaxTemplate = await templateProcessor.getConsolidatedPaxTemplatePath();
        
        // IMPORTANT: Pass forceCreateNew=true for "Generate New PAX Report" button
        const consolidatedResult = await consolidatedProcessor.processConsolidatedPaxForSingleShip(
          consolidatedPaxTemplate,
          shipId,
          dispatchFilePath,
          undefined, // selectedShipName - not needed for new generation
          true // forceCreateNew = true (CREATE NEW FILE)
        );
        
        console.log(`→ Consolidated PAX generated after new PAX: ${consolidatedResult.filename}`);
        console.log(`→ Contributing ships: ${consolidatedResult.data.contributingShips.join(', ')}`);
        
        // Save consolidated PAX report to database
        try {
          // consolidatedResult.filename is either a blob URL (if blob storage) or just filename (if filesystem)
          const filePath = blobStorage.isBlobUrl(consolidatedResult.filename) 
            ? consolidatedResult.filename 
            : `output/consolidated/pax/${consolidatedResult.filename}`;
          const filename = blobStorage.isBlobUrl(consolidatedResult.filename)
            ? path.basename(consolidatedResult.filename.split('?')[0])
            : consolidatedResult.filename;
          
          const consolidatedPaxRecord = await storage.createConsolidatedPaxReport({
            filename: filename,
            filePath: filePath,
            contributingShips: consolidatedResult.data.contributingShips,
            totalRecordCount: consolidatedResult.data.totalRecordCount,
            lastUpdatedByShip: shipId
          });
          console.log(`→ Consolidated PAX saved to database with ID: ${consolidatedPaxRecord.id}`);
        } catch (dbError) {
          console.error('→ Failed to save consolidated PAX to database:', dbError);
        }

        res.json({
          success: true,
          paxFile: paxOutputFilename,
          shipId: shipId,
          message: `PAX report generated successfully for ${shipId}`,
          consolidatedPaxGenerated: true,
          consolidatedFilename: consolidatedResult.filename,
          contributingShips: consolidatedResult.data.contributingShips
        });

      } catch (consolidatedError) {
        console.error('→ Consolidated PAX generation failed after new PAX:', consolidatedError);
        
        // Return success for individual PAX even if consolidated fails
        res.json({
          success: true,
          paxFile: paxOutputFilename,
          shipId: shipId,
          message: `PAX report generated successfully for ${shipId}`,
          consolidatedPaxGenerated: false,
          consolidatedError: consolidatedError instanceof Error ? consolidatedError.message : 'Unknown error'
        });
      }

    } catch (error) {
      console.error("PAX report generation error:", error);
      res.status(500).json({ 
        message: "Failed to generate PAX report",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Add successive PAX entry to existing PAX report (ship-aware)
  app.post("/api/add-successive-pax-entry", async (req, res) => {
    try {
      const { dispatchFileId, shipId = 'ship-a', selectedShipName } = req.body;
      
      if (!dispatchFileId) {
        return res.status(400).json({ message: "Dispatch file ID is required" });
      }

      // Get the most recent dispatch version (edited file) for the specific ship
      const dispatchVersions = await storage.getDispatchVersions(1, shipId);
      let dispatchFilePath;
      
      if (dispatchVersions.length > 0) {
        // Use the latest edited dispatch file
        const latestVersion = dispatchVersions[0];
        dispatchFilePath = latestVersion.filePath;
        console.log(`Using latest dispatch version for successive PAX: ${latestVersion.filename}`);
      } else {
        // Fallback to original uploaded file
        const dispatchFile = await storage.getUploadedFile(parseInt(dispatchFileId));
        if (!dispatchFile) {
          return res.status(404).json({ message: "Dispatch file not found" });
        }
        dispatchFilePath = path.join(process.cwd(), "uploads", dispatchFile.filename);
      }

      // Find the latest existing PAX report for this specific ship
      // On Vercel, query database/blob storage; locally use filesystem
      const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV;
      let latestPaxPath: string;
      let latestPaxFile: string;
      
      if (isVercel) {
        // On Vercel, find PAX files from database or blob storage
        // Check generated reports for PAX files
        try {
          const recentReports = await storage.getRecentGeneratedReports(50, shipId);
          const paxReports = recentReports
            .filter(r => r.paxFilePath && (r.paxFilePath.includes('pax_') || path.basename(r.paxFilePath).startsWith('pax_')))
            .sort((a, b) => {
              // Sort by creation date, newest first
              const dateA = new Date(a.createdAt || 0).getTime();
              const dateB = new Date(b.createdAt || 0).getTime();
              return dateB - dateA;
            });
          
          if (paxReports.length === 0) {
            return res.status(400).json({ message: `No existing PAX reports found for ${shipId}. Generate a new PAX report first.` });
          }
          
          latestPaxPath = paxReports[0].paxFilePath!;
          latestPaxFile = path.basename(latestPaxPath.split('?')[0]); // Remove query params from blob URL
          console.log(`Found latest PAX file from database: ${latestPaxFile} (${latestPaxPath})`);
        } catch (error) {
          console.error('Error finding PAX files from database:', error);
          return res.status(500).json({ message: `Failed to find existing PAX reports for ${shipId}` });
        }
      } else {
        // Local development - use filesystem
        const shipOutputDir = path.join(process.cwd(), "output", shipId);
        
        if (!fs.existsSync(shipOutputDir)) {
          return res.status(400).json({ message: `No PAX reports found for ${shipId}. Generate a new PAX report first.` });
        }
        
        const outputFiles = fs.readdirSync(shipOutputDir).filter(file => 
          file.startsWith('pax_') && file.endsWith('.xlsx')
        );
        
        if (outputFiles.length === 0) {
          return res.status(400).json({ message: `No existing PAX reports found for ${shipId}. Generate a new PAX report first.` });
        }

        // Sort by filename (timestamp) to get the latest
        outputFiles.sort((a, b) => {
          const timestampA = parseInt(a.replace('pax_', '').replace('.xlsx', ''));
          const timestampB = parseInt(b.replace('pax_', '').replace('.xlsx', ''));
          return timestampB - timestampA; // Newest first
        });

        latestPaxFile = outputFiles[0];
        latestPaxPath = path.join(shipOutputDir, latestPaxFile);
      }

      console.log(`Adding successive PAX entry to: ${latestPaxFile} (for ${shipId})`);
      console.log('Using dispatch data from:', path.basename(dispatchFilePath));
      
      // Add successive entry to the existing PAX report (ship-aware)
      const updatedPaxFilename = await paxProcessor.addSuccessiveEntryToPax(dispatchFilePath, latestPaxPath, shipId, selectedShipName);
      
      // Auto-generate consolidated PAX report after updating individual ship report
      console.log(`→ Auto-generating consolidated PAX after ${shipId} update (SINGLE SHIP ONLY)`);
      try {
        const consolidatedPaxTemplate = await templateProcessor.getConsolidatedPaxTemplatePath();
        // IMPORTANT: Pass forceCreateNew=false for "Add Successive PAX Entry" button
        const consolidatedResult = await consolidatedPaxProcessor.processConsolidatedPaxForSingleShip(
          consolidatedPaxTemplate,
          shipId,
          dispatchFilePath,
          selectedShipName,
          false // forceCreateNew = false (UPDATE EXISTING FILE)
        );
        
        console.log(`→ Consolidated PAX auto-generated: ${consolidatedResult.filename}`);
        
        // Save consolidated PAX report to database
        const consolidatedPaxRecord = await storage.createConsolidatedPaxReport({
          filename: consolidatedResult.filename,
          filePath: `output/consolidated/pax/${consolidatedResult.filename}`,
          contributingShips: consolidatedResult.data.contributingShips,
          totalRecordCount: consolidatedResult.data.totalRecordCount,
          lastUpdatedByShip: shipId
        });
        console.log(`→ Consolidated PAX saved to database with ID: ${consolidatedPaxRecord.id}`);
        
        res.json({
          success: true,
          paxFile: updatedPaxFilename,
          message: "Successive PAX entry added successfully",
          originalPaxFile: latestPaxFile,
          consolidatedPaxGenerated: true,
          consolidatedFilename: consolidatedResult.filename,
          contributingShips: consolidatedResult.data.contributingShips
        });
      } catch (consolidatedError) {
        console.error('→ Failed to auto-generate consolidated PAX:', consolidatedError);
        // Still return success for the individual ship update
        res.json({
          success: true,
          paxFile: updatedPaxFilename,
          message: "Successive PAX entry added successfully (consolidated generation failed)",
          originalPaxFile: latestPaxFile,
          consolidatedPaxGenerated: false,
          consolidatedError: consolidatedError instanceof Error ? consolidatedError.message : "Unknown error"
        });
      }

    } catch (error) {
      console.error("Successive PAX entry error:", error);
      res.status(500).json({ 
        message: "Failed to add successive PAX entry",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Consolidated PAX API Endpoints
  
  // Get recent consolidated PAX reports
  app.get("/api/consolidated-pax-reports", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const reports = await storage.getRecentConsolidatedPaxReports(limit);
      res.json(reports);
    } catch (error) {
      console.error("Consolidated PAX reports fetch error:", error);
      res.status(500).json({ message: "Failed to fetch consolidated PAX reports" });
    }
  });

  // Get latest consolidated PAX report  
  app.get("/api/consolidated-pax-reports/latest", async (req, res) => {
    try {
      const reports = await storage.getRecentConsolidatedPaxReports(1);
      if (reports.length === 0) {
        return res.json(null);
      }
      res.json(reports[0]);
    } catch (error) {
      console.error("Latest consolidated PAX report fetch error:", error);
      res.status(500).json({ message: "Failed to fetch latest consolidated PAX report" });
    }
  });

  // Get specific consolidated PAX report
  app.get("/api/consolidated-pax-reports/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const report = await storage.getConsolidatedPaxReport(parseInt(id));
      
      if (!report) {
        return res.status(404).json({ message: "Consolidated PAX report not found" });
      }
      
      res.json(report);
    } catch (error) {
      console.error("Consolidated PAX report fetch error:", error);
      res.status(500).json({ message: "Failed to fetch consolidated PAX report" });
    }
  });

  // Manually generate consolidated PAX report
  app.post("/api/consolidated-pax/generate", authenticateToken, requireAuth, async (req, res) => {
    try {
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      console.log('→ Manual consolidated PAX generation requested by:', user.username);
      
      const consolidatedPaxTemplate = await templateProcessor.getConsolidatedPaxTemplatePath();
      const consolidatedResult = await consolidatedPaxProcessor.processConsolidatedPax(
        consolidatedPaxTemplate,
        user.username
      );
      
      // Save consolidated PAX report to database
      // consolidatedResult.filename is either a blob URL (if blob storage) or just filename (if filesystem)
      const filePath = blobStorage.isBlobUrl(consolidatedResult.filename) 
        ? consolidatedResult.filename 
        : `output/consolidated/pax/${consolidatedResult.filename}`;
      const filename = blobStorage.isBlobUrl(consolidatedResult.filename)
        ? path.basename(consolidatedResult.filename.split('?')[0])
        : consolidatedResult.filename;
      
      const consolidatedPaxRecord = await storage.createConsolidatedPaxReport({
        filename: filename,
        filePath: filePath,
        contributingShips: consolidatedResult.data.contributingShips,
        totalRecordCount: consolidatedResult.data.totalRecordCount,
        lastUpdatedByShip: user.username
      });
      console.log(`→ Manual consolidated PAX saved to database with ID: ${consolidatedPaxRecord.id}`);
      
      res.json({
        success: true,
        message: "Consolidated PAX report generated successfully",
        filename: filename, // Return the extracted filename, not the blob URL
        contributingShips: consolidatedResult.data.contributingShips,
        totalRecords: consolidatedResult.data.totalRecordCount
      });
      
    } catch (error) {
      console.error("Manual consolidated PAX generation error:", error);
      res.status(500).json({ 
        message: "Failed to generate consolidated PAX report",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Download consolidated PAX report by filename
  app.get("/api/consolidated-pax/download/:filename", async (req, res) => {
    try {
      // URL decode the filename parameter (it might be URL-encoded)
      let filename = decodeURIComponent(req.params.filename);
      console.log(`→ Downloading consolidated PAX file (decoded): ${filename}`);
      console.log(`→ Is blob URL? ${blobStorage.isBlobUrl(filename)}`);
      
      // Check if the filename parameter is actually a blob URL
      if (blobStorage.isBlobUrl(filename)) {
        console.log(`→ Filename parameter is a blob URL, using directly: ${filename}`);
        const downloadFilename = path.basename(filename.split('?')[0]);
        await handleFileDownload(filename, res, downloadFilename);
        return;
      }
      
      // First check consolidated PAX reports table (this is where consolidated PAX reports are stored)
      let filePathOrUrl: string | undefined;
      try {
        // Try to find by filename
        const consolidatedReport = await storage.getConsolidatedPaxReportByFilename(filename);
        if (consolidatedReport) {
          // Check if filename field contains a blob URL (old records)
          if (blobStorage.isBlobUrl(consolidatedReport.filename)) {
            filePathOrUrl = consolidatedReport.filename;
            console.log(`→ Found consolidated PAX report with blob URL in filename field: ${filePathOrUrl}`);
          } else if (consolidatedReport.filePath) {
            filePathOrUrl = consolidatedReport.filePath;
            console.log(`→ Found consolidated PAX report in database: ${filePathOrUrl}`);
          }
        }
        
        // If not found by exact filename match, search all reports
        if (!filePathOrUrl) {
          const allReports = await storage.getRecentConsolidatedPaxReports(50);
          const report = allReports.find(r => {
            // Check if filename matches (could be blob URL in old records)
            if (r.filename === filename || blobStorage.isBlobUrl(r.filename)) {
              return true;
            }
            // Check if filePath matches
            if (r.filePath && (r.filePath.includes(filename) || path.basename(r.filePath) === filename)) {
              return true;
            }
            // Check if filename parameter matches the blob URL in filename field
            if (blobStorage.isBlobUrl(filename) && blobStorage.isBlobUrl(r.filename) && r.filename === filename) {
              return true;
            }
            return false;
          });
          
          if (report) {
            // Prefer filePath, but use filename if it's a blob URL (old records)
            if (blobStorage.isBlobUrl(report.filename)) {
              filePathOrUrl = report.filename;
              console.log(`→ Found consolidated PAX report by filename match (blob URL in filename field): ${filePathOrUrl}`);
            } else if (report.filePath) {
              filePathOrUrl = report.filePath;
              console.log(`→ Found consolidated PAX report by filePath match: ${filePathOrUrl}`);
            }
          }
        }
      } catch (error) {
        console.log(`→ Consolidated PAX database lookup failed: ${error}`);
      }
      
      // Fallback to filesystem if not found in database (only if it's not a blob URL)
      if (!filePathOrUrl) {
        if (blobStorage.isBlobUrl(filename)) {
          // If filename is a blob URL but not found in DB, use it directly (might be from old record format)
          console.log(`→ Filename is blob URL but not in DB, using directly: ${filename}`);
          filePathOrUrl = filename;
        } else {
          console.log(`→ Consolidated PAX not found in database, trying filesystem...`);
          const consolidatedOutputDir = path.join(process.cwd(), "output", "consolidated", "pax");
          filePathOrUrl = path.join(consolidatedOutputDir, filename);
        }
      }

      // Extract just the filename for the download (not the full blob URL)
      const downloadFilename = blobStorage.isBlobUrl(filePathOrUrl) 
        ? path.basename(filePathOrUrl.split('?')[0])
        : path.basename(filePathOrUrl);
      
      await handleFileDownload(filePathOrUrl, res, downloadFilename);
    } catch (error) {
      console.error("Consolidated PAX download error:", error);
      if (!res.headersSent) {
        res.status(500).json({ message: "Failed to download consolidated PAX file" });
      }
    }
  });

  // View consolidated PAX report (for in-browser viewing)
  app.get("/api/consolidated-pax/view/:filename", async (req, res) => {
    try {
      const { filename } = req.params;
      console.log(`→ Viewing consolidated PAX file: ${filename}`);
      
      // First check consolidated PAX reports table (this is where consolidated PAX reports are stored)
      let filePathOrUrl: string | undefined;
      try {
        const consolidatedReport = await storage.getConsolidatedPaxReportByFilename(filename);
        if (consolidatedReport?.filePath) {
          filePathOrUrl = consolidatedReport.filePath;
          console.log(`→ Found consolidated PAX report in database: ${filePathOrUrl}`);
        }
      } catch (error) {
        console.log(`→ Consolidated PAX database lookup failed: ${error}`);
      }
      
      // Fallback to filesystem if not found in database
      if (!filePathOrUrl) {
        console.log(`→ Consolidated PAX not found in database, trying filesystem...`);
        const consolidatedOutputDir = path.join(process.cwd(), "output", "consolidated", "pax");
        filePathOrUrl = path.join(consolidatedOutputDir, filename);
      }
      
      // For blob URLs, redirect; for filesystem, serve with view headers
      if (blobStorage.isBlobUrl(filePathOrUrl)) {
        res.redirect(302, filePathOrUrl);
        return;
      }
      
      if (!fs.existsSync(filePathOrUrl)) {
        return res.status(404).json({ message: "Consolidated PAX file not found" });
      }
      
      // Set headers for viewing (no attachment disposition)
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Cache-Control', 'no-cache');
      
      const fileStream = fs.createReadStream(filePathOrUrl);
      fileStream.pipe(res);
    } catch (error) {
      console.error("Consolidated PAX view error:", error);
      res.status(500).json({ message: "Failed to view consolidated PAX file" });
    }
  });

  app.get("/api/download-report/:reportId/:type", async (req, res) => {
    try {
      const { reportId, type } = req.params;
      const report = await storage.getGeneratedReport(parseInt(reportId));
      
      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }

      const filePathOrUrl = type === 'dispatch' ? report.dispatchFilePath : report.eodFilePath;
      
      if (!filePathOrUrl) {
        return res.status(404).json({ message: "Report file path not available" });
      }

      const filename = path.basename(filePathOrUrl);
      await handleFileDownload(filePathOrUrl, res, filename);
    } catch (error) {
      console.error("Report download error:", error);
      res.status(500).json({ message: "Download failed" });
    }
  });

  // Generate report for a single dispatch record
  app.post("/api/generate-single-record-report", async (req, res) => {
    try {
      const { recordId, tourName, adults, children, departure, returnTime, comp, totalGuests, notes, tourDate } = req.body;

      // Get active dispatch template
      const dispatchTemplate = await storage.getActiveDispatchTemplate();
      if (!dispatchTemplate) {
        return res.status(400).json({ message: "No active dispatch template found" });
      }

      // Create a single record for processing
      const singleRecord = {
        id: recordId || Date.now(),
        tourName,
        numAdult: adults,
        numChild: children,
        departure,
        returnTime,
        comp,
        totalGuests,
        notes: notes || "",
        tourDate,
        shipName: "",
        tourOperator: "",
        shorexManager: "",
        shorexAsstManager: "",
        isActive: true,
        createdAt: new Date()
      };

      const timestamp = Date.now();
      const outputPath = path.join(process.cwd(), "output", `dispatch_record_${recordId || timestamp}.xlsx`);

      // Generate dispatch file with single record
      await dispatchGenerator.generateDispatchFile(
        dispatchTemplate.filePath,
        [singleRecord],
        outputPath
      );

      // Store the generated report record
      const generatedReport = await storage.createGeneratedReport({
        dispatchFilePath: outputPath,
        eodFilePath: null, // Single record doesn't generate EOD
        recordCount: 1
      });

      console.log(`Generated single record report: ${outputPath}`);

      res.json({
        success: true,
        message: "Report generated successfully",
        reportId: generatedReport.id,
        outputPath,
        recordCount: 1
      });

    } catch (error) {
      console.error("Single record report generation error:", error);
      res.status(500).json({ 
        message: "Failed to generate report",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Helper function to generate reports from current records
  async function generateReportsFromRecords() {
    try {
      const dispatchTemplate = await storage.getActiveDispatchTemplate();
      const eodTemplate = await storage.getActiveEodTemplate();
      const records = await storage.getAllActiveDispatchRecords();

      if (!dispatchTemplate || !eodTemplate || records.length === 0) {
        console.log("Missing templates or no records to process");
        return;
      }

      const timestamp = Date.now();
      const dispatchOutputPath = path.join(process.cwd(), "output", `dispatch_${timestamp}.xlsx`);
      const eodOutputPath = path.join(process.cwd(), "output", `eod_${timestamp}.xlsx`);

      // Generate dispatch file with all records
      await dispatchGenerator.generateDispatchFile(
        dispatchTemplate.filePath,
        records,
        dispatchOutputPath
      );

      // Generate EOD file from the dispatch file (not from records directly)
      const excelParser = new ExcelParser();
      const dispatchData = await excelParser.parseFile(dispatchOutputPath);
      
      await eodProcessor.processEODTemplate(
        eodTemplate.filePath,
        dispatchData,
        eodOutputPath
      );

      // Store the generated report record
      await storage.createGeneratedReport({
        dispatchFilePath: dispatchOutputPath,
        eodFilePath: eodOutputPath,
        recordCount: records.length
      });

      console.log(`Generated reports: dispatch=${dispatchOutputPath}, eod=${eodOutputPath}`);

      // After EOD generation, trigger consolidated PAX generation
      try {
        console.log('→ Triggering consolidated PAX generation after EOD completion');
        const consolidatedPaxTemplate = await templateProcessor.getConsolidatedPaxTemplatePath();
        const consolidatedResult = await consolidatedPaxProcessor.processConsolidatedPax(
          consolidatedPaxTemplate,
          'system' // This is triggered by the system after EOD
        );
        
        console.log(`→ Consolidated PAX generated: ${consolidatedResult.filename}`);
        console.log(`→ Contributing ships: ${consolidatedResult.data.contributingShips.join(', ')}`);
        console.log(`→ Total records: ${consolidatedResult.data.totalRecordCount}`);
        
        // Save consolidated PAX report to database
        try {
          const consolidatedPaxRecord = await storage.createConsolidatedPaxReport({
            filename: consolidatedResult.filename,
            filePath: `output/consolidated/pax/${consolidatedResult.filename}`,
            contributingShips: consolidatedResult.data.contributingShips,
            totalRecordCount: consolidatedResult.data.totalRecordCount,
            lastUpdatedByShip: 'system'
          });
          console.log(`→ Consolidated PAX (system-triggered) saved to database with ID: ${consolidatedPaxRecord.id}`);
        } catch (dbError) {
          console.error('→ Failed to save consolidated PAX to database:', dbError);
        }
      } catch (consolidatedError) {
        console.error('→ Consolidated PAX generation failed:', consolidatedError);
        // Don't fail the entire process if consolidated PAX fails
      }

    } catch (error) {
      console.error("Report generation error:", error);
    }
  }

  // Document Sharing API Routes - Phase 1
  const { SharingController } = await import("./services/sharing-controller.js");
  const sharingController = new SharingController();

  // Share reports endpoint
  app.post("/api/sharing/share", authenticateToken, requireAuth, async (req, res) => {
    try {
      const { shareMethod, reportTypes, recipients, shipId, availableReports } = req.body;
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // Validate input
      if (!shareMethod || !reportTypes || !Array.isArray(reportTypes) || reportTypes.length === 0) {
        return res.status(400).json({ message: "Share method and report types are required" });
      }

      if ((shareMethod === 'email' || shareMethod === 'both') && (!recipients || recipients.length === 0)) {
        return res.status(400).json({ message: "Recipients required for email sharing" });
      }

      // Get actual report files from the availableReports sent by frontend
      const reportFiles = await Promise.all(reportTypes.map(async (type: string) => {
        // Handle consolidated PAX specially if not provided in availableReports
        if (type === 'consolidated-pax' && (!availableReports?.[type])) {
          console.log('→ Fetching latest consolidated PAX file for sharing');
          
          // Get the latest consolidated PAX report from database
          const consolidatedReports = await storage.getRecentConsolidatedPaxReports(1);
          if (consolidatedReports.length === 0) {
            throw new Error('No consolidated PAX reports available for sharing');
          }
          
          const latestReport = consolidatedReports[0];
          // Use filePath as-is (could be blob URL or filesystem path)
          let consolidatedPaxPath = latestReport.filePath;
          
          // Only check filesystem if it's not a blob URL
          if (!blobStorage.isBlobUrl(consolidatedPaxPath)) {
            // If relative path, make it absolute
            if (!path.isAbsolute(consolidatedPaxPath)) {
              consolidatedPaxPath = path.join(process.cwd(), consolidatedPaxPath);
            }
            
            // Check if file exists (only for filesystem paths)
            if (!fs.existsSync(consolidatedPaxPath)) {
              throw new Error(`Consolidated PAX file not found: ${latestReport.filename}`);
            }
          }
          
          return {
            path: consolidatedPaxPath,
            filename: latestReport.filename,
            type: 'consolidated-pax' as const
          };
        }
        
        const reportInfo = availableReports?.[type];
        if (!reportInfo) {
          throw new Error(`Report type ${type} is not available`);
        }
        
        // reportInfo.path could be a blob URL or filesystem path - pass it as-is
        return {
          path: reportInfo.path,
          filename: reportInfo.filename,
          type: type as 'eod' | 'dispatch' | 'pax' | 'consolidated-pax'
        };
      }));

      const result = await sharingController.shareReports({
        userId: user.userId,
        shipId: shipId || 'ship-a',
        reportTypes,
        shareMethod,
        recipients: recipients || [],
        reportFiles: reportFiles,
        userEmail: 'noreply@replit.app',
        userName: user.username,
      });

      res.json(result);
    } catch (error) {
      console.error("Share reports error:", error);
      res.status(500).json({ 
        message: "Failed to share reports", 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });

  // Get sharing history
  app.get("/api/sharing/history", authenticateToken, requireAuth, async (req, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const { shipId, limit } = req.query;
      const history = await sharingController.getSharingHistory(
        user.userId,
        shipId as string,
        parseInt(limit as string) || 50
      );

      res.json({ history });
    } catch (error) {
      console.error("Get sharing history error:", error);
      res.status(500).json({ 
        message: "Failed to get sharing history", 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });

  // Share template management
  app.get("/api/sharing/templates", authenticateToken, requireAuth, async (req, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const { shipId } = req.query;
      const templates = await sharingController.getShareTemplates(user.userId, shipId as string);

      res.json({ templates });
    } catch (error) {
      console.error("Get share templates error:", error);
      res.status(500).json({ 
        message: "Failed to get share templates", 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });

  app.post("/api/sharing/templates", authenticateToken, requireAuth, async (req, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const { name, description, shipId, reportTypes, shareMethod, recipients } = req.body;
      
      if (!name || !shipId || !reportTypes || !shareMethod) {
        return res.status(400).json({ message: "Name, ship ID, report types, and share method are required" });
      }

      const template = await sharingController.createShareTemplate({
        userId: user.userId,
        name,
        description,
        shipId,
        reportTypes,
        shareMethod,
        recipients: recipients || [],
        isActive: true,
      });

      res.status(201).json({ template });
    } catch (error) {
      console.error("Create share template error:", error);
      res.status(500).json({ 
        message: "Failed to create share template", 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });

  // Test services connection
  app.get("/api/sharing/test-services", authenticateToken, requireAuth, async (req, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // Only allow superuser and admin to test services
      if (!['superuser', 'admin'].includes(user.role as string)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const testResults = await sharingController.testServices();
      res.json(testResults);
    } catch (error) {
      console.error("Test services error:", error);
      res.status(500).json({ 
        message: "Failed to test services", 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
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
  dropboxService: DropboxService,
  eodProcessor?: EODProcessor,
  dispatchFileId?: number,
  eodTemplateFileId?: number
) {
  try {
    await storage.updateProcessingJob(jobId, { status: "processing", progress: 20 });

    const job = await storage.getProcessingJob(jobId);
    if (!job) return;

    let outputPath: string;

    // Check if we have both dispatch and EOD template files for EOD processing
    if (eodProcessor && dispatchFileId && eodTemplateFileId) {
      // Process EOD template with dispatch data
      const dispatchFile = await storage.getUploadedFile(dispatchFileId);
      const eodTemplateFile = await storage.getUploadedFile(eodTemplateFileId);
      
      if (!dispatchFile || !eodTemplateFile) {
        throw new Error("Required files not found");
      }

      // Parse dispatch file to extract data
      const dispatchFilePath = path.join("uploads", dispatchFile.filename);
      const dispatchData = await excelParser.parseFile(dispatchFilePath);
      await storage.updateProcessingJob(jobId, { progress: 40 });

      // Process EOD template with dispatch data
      const eodTemplateFilePath = path.join("uploads", eodTemplateFile.filename);
      const outputFileName = `eod_report_${Date.now()}.xlsx`;
      outputPath = await eodProcessor.processEODTemplate(
        eodTemplateFilePath,
        dispatchData,
        outputFileName
      );
      await storage.updateProcessingJob(jobId, { progress: 80 });

    } else {
      // Standard template processing
      const excelData = await storage.getExcelDataByFileId(job.fileId);
      await storage.updateProcessingJob(jobId, { progress: 40 });

      outputPath = await templateProcessor.processTemplate(
        job.templateType,
        excelData,
        job.fileId
      );
      await storage.updateProcessingJob(jobId, { progress: 80 });
    }

    // Complete job
    await storage.updateProcessingJob(jobId, {
      status: "completed",
      progress: 100,
      resultFilePath: outputPath,
      completedAt: new Date(),
    });

    // Auto-export to Dropbox if configured
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
