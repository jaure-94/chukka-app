import type { Express } from "express";
import { createServer, type Server } from "http";
import authRoutes from "./auth/routes";
import userRoutes from "./auth/userRoutes";
import { authenticateToken } from "./auth/middleware";
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
} from "./auth/roleMiddleware";
import { storage } from "./storage";
import multer from "multer";
import path from "path";
import fs from "fs";
import { ExcelParser } from "./services/excel-parser";
import { TemplateProcessor } from "./services/template-processor";
import { DropboxService } from "./services/dropbox-service";
import { EODProcessor } from "./services/eod-processor-exceljs";
import { DispatchGenerator } from "./services/dispatch-generator";
import { simpleEODProcessor } from "./services/simple-eod-processor";
import { cellExtractor } from "./services/cell-extractor";
import { PaxProcessor } from "./services/pax-processor";
import { ConsolidatedPaxProcessor } from "./services/consolidated-pax-processor";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import { 
  insertUploadedFileSchema, 
  insertProcessingJobSchema, 
  insertDispatchTemplateSchema,
  insertEodTemplateSchema,
  insertPaxTemplateSchema,
  insertDispatchRecordSchema
} from "@shared/schema";

const upload = multer({ 
  storage: multer.diskStorage({
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

  // Initialize default superuser if none exists
  const userService = await import("./services/userService");
  const userServiceInstance = new userService.UserService();
  await userServiceInstance.createDefaultSuperuser();

  // Serve uploaded files - ship-aware
  app.get("/api/files/:shipId/:filename", async (req, res) => {
    try {
      const { shipId, filename } = req.params;
      const filePath = path.join(process.cwd(), "uploads", shipId, filename);
      
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "File not found" });
      }

      // Set appropriate headers for Excel files
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    } catch (error) {
      console.error("File serving error:", error);
      res.status(500).json({ message: "Failed to serve file" });
    }
  });

  // Legacy file serving (backwards compatibility)
  app.get("/api/files/:filename", async (req, res) => {
    try {
      const { filename } = req.params;
      // Try ship-a first for backwards compatibility
      let filePath = path.join(process.cwd(), "uploads", "ship-a", filename);
      
      if (!fs.existsSync(filePath)) {
        // Fallback to root uploads directory
        filePath = path.join(process.cwd(), "uploads", filename);
      }
      
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "File not found" });
      }

      // Set appropriate headers for Excel files
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
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
      
      let filePath;
      
      // Check if this is a consolidated PAX file request
      if (shipId === 'consolidated' && req.params.filename) {
        // Consolidated PAX path: /api/output/consolidated/pax/filename.xlsx
        const consolidatedType = req.params.filename; // Should be 'pax'
        const actualFilename = req.query.file as string;
        
        if (consolidatedType === 'pax' && actualFilename) {
          filePath = path.join(process.cwd(), "output", "consolidated", "pax", actualFilename);
        } else {
          return res.status(400).json({ message: "Invalid consolidated file request. Use format: /api/output/consolidated/pax?file=filename.xlsx" });
        }
      } else if (shipId) {
        // Ship-specific path
        filePath = path.join(process.cwd(), "output", shipId, filename);
      } else {
        // Legacy path for backwards compatibility
        filePath = path.join(process.cwd(), "output", filename);
      }
      
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "File not found" });
      }

      // Set appropriate headers for Excel files
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
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

      const fileData = insertUploadedFileSchema.parse({
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
      });

      const uploadedFile = await storage.createUploadedFile(fileData);

      // Parse Excel file from ship-specific directory
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
        filePath: req.file.path, // Use the actual path from multer
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

      // Handle both absolute and relative paths
      let filePath = job.resultFilePath;
      if (!path.isAbsolute(filePath)) {
        filePath = path.join(process.cwd(), filePath);
      }
      
      console.log(`Attempting to download file: ${filePath}`);
      
      if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        return res.status(404).json({ message: "File not found on disk" });
      }

      res.download(filePath);
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

  // Template management routes
  app.post("/api/templates/dispatch", upload.single("template"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No template file provided" });
      }

      // Extract ship ID from request body or default to ship-a
      const shipId = req.body.shipId || 'ship-a';

      const templateData = insertDispatchTemplateSchema.parse({
        filename: req.file.filename,
        originalFilename: req.file.originalname,
        filePath: req.file.path,
        shipId: shipId,
      });

      const template = await storage.createDispatchTemplate(templateData);
      res.json(template);
    } catch (error) {
      console.error("Dispatch template upload error:", error);
      res.status(500).json({ message: "Template upload failed" });
    }
  });

  app.post("/api/templates/eod", upload.single("template"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No template file provided" });
      }

      // Extract ship ID from request body or default to ship-a
      const shipId = req.body.shipId || 'ship-a';

      const templateData = insertEodTemplateSchema.parse({
        filename: req.file.filename,
        originalFilename: req.file.originalname,
        filePath: req.file.path,
        shipId: shipId,
      });

      const template = await storage.createEodTemplate(templateData);
      res.json(template);
    } catch (error) {
      console.error("EOD template upload error:", error);
      res.status(500).json({ message: "Template upload failed" });
    }
  });

  app.post("/api/templates/pax", upload.single("template"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No template file provided" });
      }

      // Extract ship ID from request body or default to ship-a
      const shipId = req.body.shipId || 'ship-a';

      const templateData = insertPaxTemplateSchema.parse({
        filename: req.file.filename,
        originalFilename: req.file.originalname,
        filePath: req.file.path,
        shipId: shipId,
      });

      const template = await storage.createPaxTemplate(templateData);
      res.json(template);
    } catch (error) {
      console.error("PAX template upload error:", error);
      res.status(500).json({ message: "Template upload failed" });
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
      const template = await storage.getActiveDispatchTemplate(shipId);
      if (!template || !template.filePath) {
        return res.status(404).json({ message: `Dispatch template not found for ${shipId || 'default ship'}` });
      }

      const filePath = path.resolve(template.filePath);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "Template file not found" });
      }

      res.download(filePath, template.originalFilename || "dispatch_template.xlsx");
    } catch (error) {
      console.error("Dispatch template download error:", error);
      res.status(500).json({ message: "Failed to download dispatch template" });
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

      const filePath = path.resolve(template.filePath);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "Template file not found" });
      }

      res.download(filePath, template.originalFilename || "eod_template.xlsx");
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

      const filePath = path.resolve(template.filePath);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "Template file not found" });
      }

      res.download(filePath, template.originalFilename || "pax_template.xlsx");
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

      const templatePath = path.resolve(dispatchTemplate.filePath);
      if (!fs.existsSync(templatePath)) {
        return res.status(404).json({ message: "Dispatch template file not found" });
      }

      // Create a new dispatch version with formatting preservation
      const templateWorkbook = new ExcelJS.Workbook();
      const editedWorkbook = new ExcelJS.Workbook();
      
      await templateWorkbook.xlsx.readFile(templatePath);
      await editedWorkbook.xlsx.readFile(req.file.path);
      
      const templateWorksheet = templateWorkbook.getWorksheet(1);
      const editedWorksheet = editedWorkbook.getWorksheet(1);
      
      if (!templateWorksheet || !editedWorksheet) {
        return res.status(500).json({ message: "Unable to read worksheet data" });
      }

      console.log("Preserving formatting from template and copying edited data");
      
      // First, copy header data from rows 1-7 (including B1, B2, B4)
      for (let headerRow = 1; headerRow <= 7; headerRow++) {
        const editedHeaderRow = editedWorksheet.getRow(headerRow);
        const templateHeaderRow = templateWorksheet.getRow(headerRow);
        
        editedHeaderRow.eachCell((cell, colNumber) => {
          const targetCell = templateHeaderRow.getCell(colNumber);
          
          // Special handling for B2 (Ship Name) - use selected ship name instead
          if (headerRow === 2 && colNumber === 2 && selectedShipName) {
            console.log(`→ Updating header cell B2 with selected ship name: "${selectedShipName}"`);
            targetCell.value = selectedShipName;
          } else {
            // Special attention to other header cells B1, B4
            if ((headerRow === 1 && colNumber === 2) || // B1 - Cruise Line
                (headerRow === 4 && colNumber === 2)) { // B4 - Date
              console.log(`→ Updating header cell ${String.fromCharCode(64 + colNumber)}${headerRow} with: "${cell.value}"`);
            }
            
            // Copy the value from edited sheet to template
            targetCell.value = cell.value;
          }
        });
      }
      
      // Then copy all data from edited sheet while preserving template formatting
      editedWorksheet.eachRow((row, rowNumber) => {
        if (rowNumber >= 8) { // Data rows start from row 8 (where tour data begins)
          row.eachCell((cell, colNumber) => {
            if (colNumber <= 18) { // Process columns A-R (1-18) to include PAX columns
              const templateCell = templateWorksheet.getCell(9, colNumber); // Use row 9 as formatting template
              const targetCell = templateWorksheet.getCell(rowNumber, colNumber);
              
              // FIXED: Preserve user input for PAX ON TOUR column (Column R = 18)
              // No longer forcing synchronization with SOLD values
              targetCell.value = cell.value;
              
              // Log PAX ON TOUR values for transparency
              if (colNumber === 18 && rowNumber >= 8 && cell.value) {
                console.log(`→ Preserved PAX ON TOUR at R${rowNumber}: ${cell.value}`);
              }
              
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
      const shipUploadDir = path.join(process.cwd(), "uploads", shipId);
      const outputPath = path.join(shipUploadDir, newFilename);
      
      // Ensure ship-specific upload directory exists
      if (!fs.existsSync(shipUploadDir)) {
        fs.mkdirSync(shipUploadDir, { recursive: true });
      }
      
      await templateWorkbook.xlsx.writeFile(outputPath);
      
      // Create file record in database
      const fileData = insertUploadedFileSchema.parse({
        filename: newFilename,
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        size: fs.statSync(outputPath).size,
      });

      const uploadedFile = await storage.createUploadedFile(fileData);

      // Create dispatch version record with ship ID
      const versionCount = await storage.getDispatchVersions(100, shipId);
      const nextVersion = versionCount.length + 1;
      
      await storage.createDispatchVersion({
        filename: newFilename,
        originalFilename: req.file.originalname,
        filePath: outputPath, // Use the complete absolute path
        shipId: shipId,
        version: nextVersion,
        description: `Formatted dispatch sheet v${nextVersion} (${shipId})`,
      });

      // Clean up the original uploaded file
      fs.unlinkSync(req.file.path);

      console.log(`Saved formatted dispatch sheet: ${newFilename}`);
      
      res.json({
        success: true,
        file: uploadedFile,
        message: "Dispatch sheet saved with formatting preserved"
      });

    } catch (error) {
      console.error("Save dispatch sheet error:", error);
      res.status(500).json({ message: "Failed to save dispatch sheet with formatting" });
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
          size: fs.existsSync(dispatchFilePath) ? fs.statSync(dispatchFilePath).size : 0,
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
      console.log('File exists:', fs.existsSync(dispatchFilePath));
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
      const shipOutputDir = path.join(process.cwd(), "output", shipId);
      if (!fs.existsSync(shipOutputDir)) {
        fs.mkdirSync(shipOutputDir, { recursive: true });
      }
      
      const eodOutputPath = path.join(shipOutputDir, `eod_${timestamp}.xlsx`);
      const eodTemplatePath = path.join(process.cwd(), eodTemplate.filePath);
      await simpleEODProcessor.processMultipleRecords(
        eodTemplatePath,
        parseInt(dispatchFileId),
        dispatchFilePath,
        eodOutputPath
      );

      // Generate dispatch report as well - for now, just copy the original file to ship-specific directory
      const dispatchOutputPath = path.join(shipOutputDir, `dispatch_${timestamp}.xlsx`);
      fs.copyFileSync(dispatchFilePath, dispatchOutputPath);

      // Create a new dispatch version record with ship ID
      const dispatchVersion = await storage.createDispatchVersion({
        filename: path.basename(dispatchFilePath),
        originalFilename: `dispatch_${timestamp}.xlsx`,
        filePath: dispatchFilePath,
        shipId: shipId
      });

      // Return success with ship-specific information
      res.json({
        success: true,
        dispatchFile: path.basename(dispatchOutputPath),
        eodFile: path.basename(eodOutputPath),
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
          const consolidatedPaxRecord = await storage.createConsolidatedPaxReport({
            filename: consolidatedResult.filename,
            filePath: `output/consolidated/pax/${consolidatedResult.filename}`,
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

      // Check if existing EOD file exists in ship-specific directory
      const shipOutputDir = path.join(process.cwd(), "output", shipId);
      const existingEodPath = path.join(shipOutputDir, existingEodFilename);
      

      if (!fs.existsSync(existingEodPath)) {
        return res.status(404).json({ message: `Existing EOD file not found for ${shipId}: ${existingEodPath}` });
      }

      // Update the existing EOD file in-place (don't create new files)
      await simpleEODProcessor.addSuccessiveDispatchEntry(
        existingEodPath,
        dispatchFilePath,
        existingEodPath  // Save back to the same file
      );

      // No need to copy dispatch file or create new versions for successive entries

      res.json({
        success: true,
        eodFile: existingEodFilename,  // Return the same filename since we updated in-place
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
          const consolidatedPaxRecord = await storage.createConsolidatedPaxReport({
            filename: consolidatedResult.filename,
            filePath: `output/consolidated/pax/${consolidatedResult.filename}`,
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

      console.log('File exists:', fs.existsSync(dispatchFilePath));
      
      // Generate PAX report using PaxProcessor with ship ID
      const paxTemplatePath = path.join(process.cwd(), paxTemplate.filePath);
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

      // Generate new PAX report using PaxProcessor with ship ID
      const paxTemplatePath = path.join(process.cwd(), paxTemplate.filePath);
      const paxOutputFilename = await paxProcessor.processDispatchToPax(dispatchFilePath, paxTemplatePath, shipId);

      // Auto-generate consolidated PAX report
      try {
        const consolidatedProcessor = new ConsolidatedPaxProcessor();
        const templateProcessor = new TemplateProcessor();
        const consolidatedPaxTemplate = await templateProcessor.getConsolidatedPaxTemplatePath();
        
        const consolidatedResult = await consolidatedProcessor.processConsolidatedPaxForSingleShip(
          consolidatedPaxTemplate,
          shipId,
          dispatchFilePath
        );
        
        console.log(`→ Consolidated PAX generated after new PAX: ${consolidatedResult.filename}`);
        console.log(`→ Contributing ships: ${consolidatedResult.data.contributingShips.join(', ')}`);
        
        // Save consolidated PAX report to database
        try {
          const consolidatedPaxRecord = await storage.createConsolidatedPaxReport({
            filename: consolidatedResult.filename,
            filePath: `output/consolidated/pax/${consolidatedResult.filename}`,
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

      const latestPaxFile = outputFiles[0];
      const latestPaxPath = path.join(shipOutputDir, latestPaxFile);

      console.log(`Adding successive PAX entry to: ${latestPaxFile} (for ${shipId})`);
      console.log('Using dispatch data from:', path.basename(dispatchFilePath));
      
      // Add successive entry to the existing PAX report (ship-aware)
      const updatedPaxFilename = await paxProcessor.addSuccessiveEntryToPax(dispatchFilePath, latestPaxPath, shipId, selectedShipName);
      
      // Auto-generate consolidated PAX report after updating individual ship report
      console.log(`→ Auto-generating consolidated PAX after ${shipId} update`);
      try {
        const consolidatedPaxTemplate = await templateProcessor.getConsolidatedPaxTemplatePath();
        const consolidatedResult = await consolidatedPaxProcessor.processConsolidatedPax(
          consolidatedPaxTemplate,
          shipId,
          false,
          selectedShipName
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
      const consolidatedPaxRecord = await storage.createConsolidatedPaxReport({
        filename: consolidatedResult.filename,
        filePath: `output/consolidated/pax/${consolidatedResult.filename}`,
        contributingShips: consolidatedResult.data.contributingShips,
        totalRecordCount: consolidatedResult.data.totalRecordCount,
        lastUpdatedByShip: user.username
      });
      console.log(`→ Manual consolidated PAX saved to database with ID: ${consolidatedPaxRecord.id}`);
      
      res.json({
        success: true,
        message: "Consolidated PAX report generated successfully",
        filename: consolidatedResult.filename,
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
      const { filename } = req.params;
      const consolidatedOutputDir = path.join(process.cwd(), "output", "consolidated", "pax");
      const filePath = path.join(consolidatedOutputDir, filename);
      
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "Consolidated PAX file not found" });
      }

      console.log(`→ Downloading consolidated PAX file: ${filename}`);
      
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    } catch (error) {
      console.error("Consolidated PAX download error:", error);
      res.status(500).json({ message: "Failed to download consolidated PAX file" });
    }
  });

  app.get("/api/download-report/:reportId/:type", async (req, res) => {
    try {
      const { reportId, type } = req.params;
      const report = await storage.getGeneratedReport(parseInt(reportId));
      
      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }

      const filePath = type === 'dispatch' ? report.dispatchFilePath : report.eodFilePath;
      
      if (!filePath) {
        return res.status(404).json({ message: "Report file path not available" });
      }

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "Report file not found" });
      }

      const filename = path.basename(filePath);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
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
          const consolidatedPaxPath = path.join(process.cwd(), latestReport.filePath);
          
          // Check if file exists
          if (!fs.existsSync(consolidatedPaxPath)) {
            throw new Error(`Consolidated PAX file not found: ${latestReport.filename}`);
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
