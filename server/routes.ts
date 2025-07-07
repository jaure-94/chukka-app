import type { Express } from "express";
import { createServer, type Server } from "http";
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
import { 
  insertUploadedFileSchema, 
  insertProcessingJobSchema, 
  insertDispatchTemplateSchema,
  insertEodTemplateSchema,
  insertDispatchRecordSchema
} from "@shared/schema";

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
  const eodProcessor = new EODProcessor();
  const dispatchGenerator = new DispatchGenerator();

  // Serve uploaded files
  app.get("/api/files/:filename", async (req, res) => {
    try {
      const { filename } = req.params;
      const filePath = path.join(process.cwd(), "uploads", filename);
      
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

  // Serve output files (generated reports)
  app.get("/api/output/:filename", async (req, res) => {
    try {
      const { filename } = req.params;
      const filePath = path.join(process.cwd(), "output", filename);
      
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

      console.log('Parsed data preview:', JSON.stringify({
        sheets: parsedData.sheets.map(sheet => ({
          name: sheet.name,
          rowCount: sheet.data.length,
          columns: sheet.columns,
          sampleData: sheet.data.slice(0, 3)
        }))
      }, null, 2));

      // Create a dispatch version record for tracking edited files
      const versionCount = await storage.getDispatchVersions(100);
      const nextVersion = versionCount.length + 1;
      
      await storage.createDispatchVersion({
        filename: uploadedFile.filename,
        originalFilename: uploadedFile.originalName,
        filePath: path.join("uploads", uploadedFile.filename),
        version: nextVersion,
        description: `Edited dispatch sheet v${nextVersion}`,
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

  // Start processing endpoint
  app.post("/api/process", async (req, res) => {
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

  // Template management routes
  app.post("/api/templates/dispatch", upload.single("template"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No template file provided" });
      }

      const templateData = insertDispatchTemplateSchema.parse({
        filename: req.file.filename,
        originalFilename: req.file.originalname,
        filePath: req.file.path,
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

      const templateData = insertEodTemplateSchema.parse({
        filename: req.file.filename,
        originalFilename: req.file.originalname,
        filePath: req.file.path,
      });

      const template = await storage.createEodTemplate(templateData);
      res.json(template);
    } catch (error) {
      console.error("EOD template upload error:", error);
      res.status(500).json({ message: "Template upload failed" });
    }
  });

  app.get("/api/templates/status", async (req, res) => {
    try {
      const dispatchTemplate = await storage.getActiveDispatchTemplate();
      const eodTemplate = await storage.getActiveEodTemplate();
      
      res.json({
        dispatch: dispatchTemplate,
        eod: eodTemplate,
        hasTemplates: !!(dispatchTemplate && eodTemplate)
      });
    } catch (error) {
      console.error("Template status error:", error);
      res.status(500).json({ message: "Failed to get template status" });
    }
  });

  // Get dispatch templates
  app.get("/api/dispatch-templates", async (req, res) => {
    try {
      const template = await storage.getActiveDispatchTemplate();
      console.log("Dispatch template query result:", template);
      res.json(template || {});
    } catch (error) {
      console.error("Dispatch template fetch error:", error);
      res.status(500).json({ message: "Failed to fetch dispatch template" });
    }
  });

  // Get EOD templates
  app.get("/api/eod-templates", async (req, res) => {
    try {
      const template = await storage.getActiveEodTemplate();
      console.log("EOD template query result:", template);
      res.json(template || {});
    } catch (error) {
      console.error("EOD template fetch error:", error);
      res.status(500).json({ message: "Failed to fetch EOD template" });
    }
  });

  // Download dispatch template
  app.get("/api/templates/dispatch/download", async (req, res) => {
    try {
      const template = await storage.getActiveDispatchTemplate();
      if (!template || !template.filePath) {
        return res.status(404).json({ message: "Dispatch template not found" });
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

  // Download EOD template
  app.get("/api/templates/eod/download", async (req, res) => {
    try {
      const template = await storage.getActiveEodTemplate();
      if (!template || !template.filePath) {
        return res.status(404).json({ message: "EOD template not found" });
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
      const reports = await storage.getRecentGeneratedReports(10);
      res.json(reports);
    } catch (error) {
      console.error("Generated reports fetch error:", error);
      res.status(500).json({ message: "Failed to fetch generated reports" });
    }
  });

  // Get dispatch versions
  app.get("/api/dispatch-versions", async (req, res) => {
    try {
      const versions = await storage.getDispatchVersions(20);
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

  // Get all output files with metadata
  app.get("/api/output-files", async (req, res) => {
    try {
      const outputDir = path.join(process.cwd(), "output");
      
      if (!fs.existsSync(outputDir)) {
        return res.json([]);
      }

      const files = fs.readdirSync(outputDir).filter(file => file.endsWith('.xlsx'));
      
      const fileList = files.map(filename => {
        const filePath = path.join(outputDir, filename);
        const stats = fs.statSync(filePath);
        
        // Parse filename to determine type
        const isEOD = filename.startsWith('eod_');
        const isDispatch = filename.startsWith('dispatch_');
        
        return {
          filename,
          type: isEOD ? 'EOD Report' : isDispatch ? 'Dispatch Report' : 'Other',
          size: stats.size,
          createdAt: stats.birthtime,
          downloadUrl: `/api/output/${filename}`
        };
      });

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

      const dispatchFile = await storage.getUploadedFile(parseInt(dispatchFileId));
      if (!dispatchFile) {
        return res.status(404).json({ message: "Dispatch file not found" });
      }

      const dispatchFilePath = path.join(process.cwd(), "uploads", dispatchFile.filename);
      const dispatchData = await excelParser.parseFile(dispatchFilePath);
      
      // Extract tour data to see what's being found
      const extractedData = eodProcessor.extractDispatchData(dispatchData);
      
      res.json({
        file: dispatchFile,
        parsedData: dispatchData,
        extractedTours: extractedData,
        debugInfo: {
          totalSheets: dispatchData.sheets.length,
          sheetsWithData: dispatchData.sheets.filter(s => s.data.length > 0).length,
          firstSheetColumns: dispatchData.sheets.length > 0 && dispatchData.sheets[0].data.length > 0 
            ? Object.keys(dispatchData.sheets[0].data[0]) 
            : []
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

      // Get the uploaded dispatch file
      const dispatchFile = await storage.getUploadedFile(parseInt(dispatchFileId));
      if (!dispatchFile) {
        return res.status(404).json({ message: "Dispatch file not found" });
      }
      
      console.log('Dispatch file object:', dispatchFile);

      // Get active EOD template
      const eodTemplate = await storage.getActiveEodTemplate();
      if (!eodTemplate) {
        return res.status(400).json({ message: "No active EOD template found" });
      }

      // Parse dispatch data
      const dispatchFilePath = path.join(process.cwd(), "uploads", dispatchFile.filename);
      console.log('Dispatch file path:', dispatchFilePath);
      console.log('File exists:', fs.existsSync(dispatchFilePath));
      const dispatchData = await excelParser.parseFile(dispatchFilePath);
      console.log('Dispatch data for EOD processing:', JSON.stringify({
        filename: dispatchData.filename,
        sheets: dispatchData.sheets.map(sheet => ({
          name: sheet.name,
          rowCount: sheet.data.length,
          columns: sheet.data.length > 0 ? Object.keys(sheet.data[0]) : [],
          firstRowSample: sheet.data.length > 0 ? sheet.data[0] : null
        }))
      }, null, 2));

      // Generate timestamp for unique filenames
      const timestamp = Date.now();
      
      // Process EOD template with multiple dispatch records
      const eodOutputPath = path.join(process.cwd(), "output", `eod_${timestamp}.xlsx`);
      const eodTemplatePath = path.join(process.cwd(), eodTemplate.filePath);
      await simpleEODProcessor.processMultipleRecords(
        eodTemplatePath,
        parseInt(dispatchFileId),
        dispatchFilePath,
        eodOutputPath
      );

      // Generate dispatch report as well - for now, just copy the original file
      const dispatchOutputPath = path.join(process.cwd(), "output", `dispatch_${timestamp}.xlsx`);
      fs.copyFileSync(dispatchFilePath, dispatchOutputPath);

      // For now, skip database record and just return success
      res.json({
        success: true,
        dispatchFile: path.basename(dispatchOutputPath),
        eodFile: path.basename(eodOutputPath),
        message: "EOD report generated successfully"
      });

    } catch (error) {
      console.error("EOD processing error:", error);
      res.status(500).json({ 
        message: "Failed to process EOD report",
        error: error instanceof Error ? error.message : "Unknown error"
      });
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
    } catch (error) {
      console.error("Report generation error:", error);
    }
  }

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
