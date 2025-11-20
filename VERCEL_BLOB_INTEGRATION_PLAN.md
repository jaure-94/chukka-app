# Vercel Blob Storage Integration Plan

## Executive Summary

This document outlines a comprehensive plan for integrating Vercel Blob Storage into the Chukka app to replace filesystem-based file storage with a production-ready, persistent storage solution compatible with Vercel's serverless environment.

**Key Objectives:**
- Replace ephemeral `/tmp` storage with persistent Vercel Blob Storage
- Maintain ship-specific file organization
- Preserve existing file access patterns
- Enable seamless file upload/download/report generation
- Support Dropbox integration without disruption

---

## Part 1: How Vercel Blob Storage Works

### 1.1 Core Concepts

**Vercel Blob Storage** is an object storage service (similar to AWS S3) that:
- Stores files as **blobs** (binary large objects)
- Provides **unique URLs** for each file (CDN-backed)
- Supports **metadata** (custom key-value pairs)
- Offers **automatic CDN distribution** for fast downloads
- Provides **persistent storage** across serverless invocations
- Has **no directory structure** (flat namespace with path-like keys)

### 1.2 Key Operations

```typescript
// Upload a file
const blob = await put(filename, fileBuffer, {
  access: 'public', // or 'private'
  contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  addRandomSuffix: true // prevents overwrites
});

// Result: { url: 'https://...', pathname: '...', size: 12345 }

// Download a file
const blob = await get(blobUrl);
// Result: { url: '...', downloadUrl: '...', size: 12345 }

// Delete a file
await del(blobUrl);

// List files (by prefix)
const { blobs } = await list({ prefix: 'uploads/ship-a/' });
```

### 1.3 Storage Model

**Current (Filesystem):**
```
uploads/
  ship-a/
    template_123.xlsx
    dispatch_456.xlsx
output/
  ship-a/
    eod_789.xlsx
    pax_012.xlsx
```

**With Vercel Blob (Path-like Keys):**
```
uploads/ship-a/template_123.xlsx  → Blob URL
uploads/ship-a/dispatch_456.xlsx  → Blob URL
output/ship-a/eod_789.xlsx        → Blob URL
output/ship-a/pax_012.xlsx        → Blob URL
```

**Database Storage:**
- Store **blob URLs** instead of filesystem paths
- Keep ship-specific organization via path prefixes
- Maintain backward compatibility with path-based lookups

---

## Part 2: Current Architecture Analysis

### 2.1 File Flow Layers

Your app has **4 distinct layers** where files are handled:

#### **Layer 1: Upload Layer** (`server/routes.ts`)
- **Endpoints:** `/api/upload`, `/api/templates/*`
- **Current Behavior:**
  - Multer receives file → writes to disk (`uploads/{shipId}/`) or `/tmp` (Vercel)
  - File path stored in database (`filePath` field)
  - File parsed by `ExcelParser`
- **Files Created:** Templates, initial dispatch uploads

#### **Layer 2: Processing Layer** (`server/services/*-processor.ts`)
- **Services:** `PaxProcessor`, `EODProcessor`, `ConsolidatedPaxProcessor`, `DispatchGenerator`
- **Current Behavior:**
  - **Read:** Loads templates from `filePath` (database) → `workbook.xlsx.readFile(filePath)`
  - **Read:** Loads dispatch files from `filePath` → `XLSX.readFile(filePath)`
  - **Write:** Generates reports → `workbook.xlsx.writeFile(outputPath)`
- **Files Read:** Templates, dispatch sheets
- **Files Created:** Generated reports (EOD, PAX, consolidated PAX)

#### **Layer 3: Storage Layer** (`server/storage.ts`)
- **Current Behavior:**
  - Stores file paths in database (`filePath`, `dispatchFilePath`, `eodFilePath`)
  - Retrieves file paths for processors
  - No direct file I/O (delegates to filesystem)
- **Database Fields:**
  - `dispatchTemplates.filePath`
  - `eodTemplates.filePath`
  - `paxTemplates.filePath`
  - `dispatchVersions.filePath`
  - `generatedReports.dispatchFilePath`, `eodFilePath`
  - `consolidatedPaxReports.filePath`
  - `processingJobs.resultFilePath`

#### **Layer 4: Download Layer** (`server/routes.ts`)
- **Endpoints:** `/api/files/*`, `/api/output/*`, `/api/download/*`
- **Current Behavior:**
  - Reads file from filesystem path
  - Streams file to client via `fs.createReadStream()`
- **Files Served:** Templates, dispatch versions, generated reports

### 2.2 File Access Patterns

**Pattern 1: Template Upload → Storage → Later Read**
```
User uploads template
  → Multer saves to disk
  → Database stores filePath
  → Later: Processor reads template from filePath
```

**Pattern 2: Dispatch Upload → Edit → Save**
```
User uploads dispatch
  → Saved to uploads/{shipId}/
  → User edits in browser
  → Save endpoint writes edited version
  → Database stores new filePath
```

**Pattern 3: Report Generation**
```
Processor reads template (from filePath)
  → Processor reads dispatch data (from filePath)
  → Processor generates report
  → Processor writes to output/{shipId}/
  → Database stores output filePath
```

**Pattern 4: File Download**
```
User requests download
  → API looks up filePath from database
  → Reads file from filesystem
  → Streams to client
```

### 2.3 Critical Integration Points

**Point A: File Upload (Multer)**
- Currently: Writes to disk or `/tmp`
- **Change:** Upload to Blob, store blob URL in database

**Point B: Template Reading (Processors)**
- Currently: `workbook.xlsx.readFile(filePath)`
- **Change:** Download from Blob to buffer, read from buffer

**Point C: Report Writing (Processors)**
- Currently: `workbook.xlsx.writeFile(outputPath)`
- **Change:** Write to buffer, upload to Blob, store blob URL

**Point D: File Serving (Download Endpoints)**
- Currently: `fs.createReadStream(filePath)`
- **Change:** Redirect to blob URL or proxy through Blob API

---

## Part 3: Integration Architecture

### 3.1 New Abstraction Layer: `BlobStorageService`

Create a **unified file storage service** that abstracts Blob operations:

```typescript
// server/services/blob-storage.ts
export class BlobStorageService {
  // Upload file to Blob Storage
  async uploadFile(
    buffer: Buffer,
    key: string, // e.g., 'uploads/ship-a/template_123.xlsx'
    contentType: string
  ): Promise<{ url: string; pathname: string }>

  // Download file from Blob Storage
  async downloadFile(blobUrl: string): Promise<Buffer>

  // Delete file from Blob Storage
  async deleteFile(blobUrl: string): Promise<void>

  // Get file URL (for direct access)
  getFileUrl(blobUrl: string): string

  // Check if path is a blob URL (vs filesystem path)
  isBlobUrl(path: string): boolean
}
```

**Benefits:**
- Single point of change for storage logic
- Easy to switch between Blob and filesystem (local dev)
- Handles URL vs path conversion automatically

### 3.2 Integration at Each Layer

#### **Layer 1: Upload Layer Integration**

**Current Code:**
```typescript
// server/routes.ts
app.post("/api/upload", upload.single("file"), async (req, res) => {
  const filePath = getUploadedFilePath(req, shipId); // Writes to /tmp or disk
  await storage.createDispatchVersion({ filePath });
});
```

**With Blob:**
```typescript
app.post("/api/upload", upload.single("file"), async (req, res) => {
  const buffer = req.file.buffer || fs.readFileSync(req.file.path);
  const key = `uploads/${shipId}/${req.file.filename}`;
  const { url } = await blobStorage.uploadFile(buffer, key, req.file.mimetype);
  await storage.createDispatchVersion({ filePath: url }); // Store blob URL
});
```

**Changes:**
- Remove `getUploadedFilePath()` helper
- Upload directly to Blob from Multer buffer
- Store blob URL in database instead of filesystem path

#### **Layer 2: Processing Layer Integration**

**Current Code:**
```typescript
// server/services/pax-processor.ts
const workbook = new ExcelJS.Workbook();
await workbook.xlsx.readFile(paxTemplatePath); // Reads from filesystem
// ... process ...
await workbook.xlsx.writeFile(outputPath); // Writes to filesystem
```

**With Blob:**
```typescript
// Helper function in each processor
async function loadWorkbookFromBlob(blobUrl: string): Promise<ExcelJS.Workbook> {
  const buffer = await blobStorage.downloadFile(blobUrl);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  return workbook;
}

async function saveWorkbookToBlob(
  workbook: ExcelJS.Workbook,
  key: string
): Promise<string> {
  const buffer = await workbook.xlsx.writeBuffer();
  const { url } = await blobStorage.uploadFile(
    buffer,
    key,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  return url;
}

// Usage in processor
const templateUrl = template.filePath; // Blob URL from database
const workbook = await loadWorkbookFromBlob(templateUrl);
// ... process ...
const outputKey = `output/${shipId}/pax_${Date.now()}.xlsx`;
const outputUrl = await saveWorkbookToBlob(workbook, outputKey);
```

**Changes:**
- Replace all `readFile()` calls with `loadWorkbookFromBlob()`
- Replace all `writeFile()` calls with `saveWorkbookToBlob()`
- Update all processors: `PaxProcessor`, `EODProcessor`, `ConsolidatedPaxProcessor`, `DispatchGenerator`

#### **Layer 3: Storage Layer Integration**

**Current Code:**
```typescript
// server/storage.ts
async createDispatchVersion(version: InsertDispatchVersion) {
  // filePath is stored as-is (filesystem path)
  await db.insert(dispatchVersions).values(version);
}
```

**With Blob:**
```typescript
// No changes needed! Storage layer just stores URLs
// The URL format doesn't matter to the database layer
// Processors handle URL vs path distinction
```

**Changes:**
- **None required** - Database stores URLs/paths as strings
- Processors handle blob URL resolution

#### **Layer 4: Download Layer Integration**

**Current Code:**
```typescript
// server/routes.ts
app.get("/api/files/:shipId/:filename", async (req, res) => {
  const filePath = path.join(process.cwd(), "uploads", shipId, filename);
  const fileStream = fs.createReadStream(filePath);
  fileStream.pipe(res);
});
```

**With Blob:**
```typescript
app.get("/api/files/:shipId/:filename", async (req, res) => {
  const version = await storage.getDispatchVersion(id);
  const filePath = version.filePath; // Blob URL
  
  if (blobStorage.isBlobUrl(filePath)) {
    // Option 1: Redirect to blob URL (CDN, fastest)
    res.redirect(blobStorage.getFileUrl(filePath));
    
    // Option 2: Proxy through server (if auth needed)
    const buffer = await blobStorage.downloadFile(filePath);
    res.setHeader('Content-Type', 'application/vnd...');
    res.send(buffer);
  } else {
    // Fallback for local filesystem (dev mode)
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  }
});
```

**Changes:**
- Check if path is blob URL or filesystem path
- Redirect to blob URL (preferred) or proxy download
- Maintain backward compatibility for local dev

---

## Part 4: Data Flow Changes

### 4.1 Upload Flow (Before → After)

**BEFORE:**
```
1. Multer receives file
2. Writes to uploads/{shipId}/filename.xlsx (or /tmp on Vercel)
3. Database stores: filePath = "uploads/ship-a/filename.xlsx"
4. File exists on filesystem
```

**AFTER:**
```
1. Multer receives file (buffer in memory)
2. Upload to Blob: key = "uploads/ship-a/filename.xlsx"
3. Blob returns: { url: "https://...", pathname: "..." }
4. Database stores: filePath = "https://..." (blob URL)
5. File exists in Blob Storage (persistent)
```

### 4.2 Processing Flow (Before → After)

**BEFORE:**
```
1. Processor gets templatePath from database
2. workbook.xlsx.readFile(templatePath) // Reads from filesystem
3. Process data
4. workbook.xlsx.writeFile(outputPath) // Writes to filesystem
5. Database stores: resultFilePath = "output/ship-a/report.xlsx"
```

**AFTER:**
```
1. Processor gets templateUrl from database (blob URL)
2. buffer = await blobStorage.downloadFile(templateUrl)
3. workbook.xlsx.load(buffer) // Loads from buffer
4. Process data
5. buffer = await workbook.xlsx.writeBuffer()
6. outputUrl = await blobStorage.uploadFile(buffer, "output/ship-a/report.xlsx")
7. Database stores: resultFilePath = outputUrl (blob URL)
```

### 4.3 Download Flow (Before → After)

**BEFORE:**
```
1. User requests /api/files/ship-a/template.xlsx
2. API looks up filePath from database
3. fs.createReadStream(filePath) // Reads from filesystem
4. Stream to client
```

**AFTER:**
```
1. User requests /api/files/ship-a/template.xlsx
2. API looks up filePath from database (blob URL)
3. Option A: res.redirect(blobUrl) // CDN serves file (fastest)
   Option B: buffer = await blobStorage.downloadFile(blobUrl)
             res.send(buffer) // Proxy through server
```

---

## Part 5: Implementation Strategy

### 5.1 Phase 1: Foundation (Day 1)

**Tasks:**
1. Install `@vercel/blob` package
2. Create `BlobStorageService` class
3. Add environment variable: `BLOB_READ_WRITE_TOKEN`
4. Implement upload/download/delete methods
5. Add helper functions for ExcelJS integration

**Files to Create:**
- `server/services/blob-storage.ts`

**Files to Modify:**
- `package.json` (add dependency)
- `.env.example` (add token variable)

### 5.2 Phase 2: Upload Integration (Day 1-2)

**Tasks:**
1. Update `/api/upload` endpoint
2. Update `/api/templates/dispatch` endpoint
3. Update `/api/templates/eod` endpoint
4. Update `/api/templates/pax` endpoint
5. Update `/api/save-dispatch-sheet` endpoint

**Files to Modify:**
- `server/routes.ts` (upload endpoints)

**Testing:**
- Upload templates → verify blob URLs in database
- Upload dispatch → verify blob URLs in database

### 5.3 Phase 3: Processing Integration (Day 2-3)

**Tasks:**
1. Create helper functions: `loadWorkbookFromBlob()`, `saveWorkbookToBlob()`
2. Update `PaxProcessor.processDispatchToPax()`
3. Update `EODProcessor.processEODTemplate()`
4. Update `ConsolidatedPaxProcessor.processConsolidatedPax()`
5. Update `DispatchGenerator.generateDispatch()`
6. Update `ExcelParser.parseFile()`
7. Update `CellExtractor.extractCells()`

**Files to Modify:**
- `server/services/pax-processor.ts`
- `server/services/simple-eod-processor.ts`
- `server/services/consolidated-pax-processor.ts`
- `server/services/dispatch-generator.ts`
- `server/services/excel-parser.ts`
- `server/services/cell-extractor.ts`

**Testing:**
- Generate PAX report → verify blob URL stored
- Generate EOD report → verify blob URL stored
- Generate consolidated PAX → verify blob URL stored

### 5.4 Phase 4: Download Integration (Day 3)

**Tasks:**
1. Update `/api/files/:shipId/:filename` endpoint
2. Update `/api/output/:shipId/:filename` endpoint
3. Update `/api/download/:jobId` endpoint
4. Add blob URL detection logic
5. Implement redirect vs proxy decision

**Files to Modify:**
- `server/routes.ts` (download endpoints)

**Testing:**
- Download template → verify file served correctly
- Download generated report → verify file served correctly
- Test CDN redirect performance

### 5.5 Phase 5: Dropbox Integration (Day 3)

**Tasks:**
1. Update `DropboxService.uploadFile()` to handle blob URLs
2. Download from Blob before uploading to Dropbox
3. Test end-to-end sharing flow

**Files to Modify:**
- `server/services/dropbox-service.ts`

**Testing:**
- Share report → verify Dropbox upload works
- Verify blob file downloaded before Dropbox upload

### 5.6 Phase 6: Cleanup & Optimization (Day 3-4)

**Tasks:**
1. Remove `/tmp` file writing logic
2. Remove `getUploadedFilePath()` helper
3. Add migration script for existing files (optional)
4. Update error handling for blob operations
5. Add logging for blob operations
6. Performance testing

**Files to Modify:**
- `server/routes.ts` (remove temp file logic)
- Add error handling throughout

---

## Part 6: Key Design Decisions

### 6.1 Blob Key Naming Strategy

**Decision:** Use path-like keys to maintain ship organization

**Format:** `{category}/{shipId}/{filename}`

**Examples:**
- `uploads/ship-a/dispatch_template.xlsx`
- `uploads/ship-b/eod_template.xlsx`
- `output/ship-a/pax_1234567890.xlsx`
- `output/consolidated/pax/consolidated_1234567890.xlsx`

**Benefits:**
- Maintains logical organization
- Easy to list files by ship (`list({ prefix: 'uploads/ship-a/' })`)
- Clear separation of uploads vs outputs

### 6.2 URL Storage in Database

**Decision:** Store full blob URLs in `filePath` fields

**Rationale:**
- Direct access to files
- No need for URL reconstruction
- Backward compatible (can detect blob URL vs path)

**Implementation:**
```typescript
// Detect blob URL
function isBlobUrl(path: string): boolean {
  return path.startsWith('https://') && path.includes('blob.vercel-storage.com');
}

// Use in processors
if (isBlobUrl(filePath)) {
  // Download from blob
} else {
  // Read from filesystem (local dev)
}
```

### 6.3 Download Strategy: Redirect vs Proxy

**Decision:** Use redirect for public files, proxy for private files

**Public Files (Templates, Reports):**
- Redirect to blob URL (CDN serves directly)
- Faster, less server load
- No authentication needed

**Private Files (if needed in future):**
- Proxy through server
- Add authentication middleware
- More control over access

**Implementation:**
```typescript
if (isPublicFile(filePath)) {
  res.redirect(blobStorage.getFileUrl(filePath));
} else {
  const buffer = await blobStorage.downloadFile(filePath);
  res.send(buffer);
}
```

### 6.4 Local Development Compatibility

**Decision:** Support both Blob and filesystem in local dev

**Rationale:**
- Developers may not have Blob token
- Faster iteration without Blob API calls
- Easy to test both paths

**Implementation:**
```typescript
const useBlob = process.env.VERCEL === '1' || process.env.USE_BLOB === 'true';

if (useBlob) {
  // Use Blob Storage
} else {
  // Use filesystem (local dev)
}
```

---

## Part 7: Migration Considerations

### 7.1 Existing Files

**Challenge:** Existing files in database have filesystem paths

**Options:**
1. **Do Nothing:** Let old files remain on filesystem (if accessible)
2. **Migrate on Access:** Download from filesystem, upload to Blob when accessed
3. **Bulk Migration:** Script to migrate all files at once

**Recommendation:** Option 2 (migrate on access)
- No downtime
- Only migrate files that are actually used
- Gradual migration

### 7.2 Database Schema

**No Changes Required:**
- `filePath` fields already store strings
- Can store URLs or paths interchangeably
- Processors handle detection

### 7.3 Backward Compatibility

**Strategy:** Support both blob URLs and filesystem paths

**Implementation:**
```typescript
async function getFileBuffer(filePathOrUrl: string): Promise<Buffer> {
  if (blobStorage.isBlobUrl(filePathOrUrl)) {
    return await blobStorage.downloadFile(filePathOrUrl);
  } else {
    return fs.readFileSync(filePathOrUrl);
  }
}
```

---

## Part 8: Error Handling & Edge Cases

### 8.1 Blob Upload Failures

**Scenario:** Blob upload fails during file upload

**Handling:**
```typescript
try {
  const { url } = await blobStorage.uploadFile(buffer, key, contentType);
  await storage.createDispatchVersion({ filePath: url });
} catch (error) {
  console.error('Blob upload failed:', error);
  // Option 1: Retry with exponential backoff
  // Option 2: Fallback to /tmp (ephemeral, log warning)
  // Option 3: Return error to user
}
```

### 8.2 Blob Download Failures

**Scenario:** Blob download fails during processing

**Handling:**
```typescript
try {
  const buffer = await blobStorage.downloadFile(blobUrl);
  await workbook.xlsx.load(buffer);
} catch (error) {
  console.error('Blob download failed:', error);
  throw new Error('Failed to load template from storage');
}
```

### 8.3 Missing Files

**Scenario:** Blob URL exists in database but file deleted from Blob

**Handling:**
- Add validation: Check file exists before processing
- Add cleanup: Remove orphaned database records
- Add monitoring: Alert on missing file access

### 8.4 Large File Handling

**Scenario:** Files exceed Blob size limits (currently 4.5GB)

**Handling:**
- Validate file size before upload
- Return clear error message
- Consider chunked uploads for very large files (future)

---

## Part 9: Performance Considerations

### 9.1 CDN Benefits

**Blob URLs are CDN-backed:**
- Fast global distribution
- Reduced server load
- Better user experience

### 9.2 Caching Strategy

**Templates:**
- Rarely change
- Can cache in memory (with invalidation)
- Blob CDN also caches

**Generated Reports:**
- Unique per generation
- No caching needed
- CDN handles distribution

### 9.3 Download Performance

**Redirect (Preferred):**
- Client downloads directly from CDN
- No server bandwidth used
- Fastest option

**Proxy:**
- Server downloads from Blob, then serves to client
- Uses server bandwidth
- Slower but more control

---

## Part 10: Testing Strategy

### 10.1 Unit Tests

**Test `BlobStorageService`:**
- Upload file → verify URL returned
- Download file → verify buffer matches
- Delete file → verify file removed
- List files → verify correct files returned

### 10.2 Integration Tests

**Test Upload Flow:**
1. Upload template → verify blob URL in database
2. Upload dispatch → verify blob URL in database

**Test Processing Flow:**
1. Generate PAX report → verify blob URL stored
2. Generate EOD report → verify blob URL stored
3. Verify reports are downloadable

**Test Download Flow:**
1. Request file download → verify file served
2. Test redirect vs proxy behavior

### 10.3 End-to-End Tests

**Full Workflow:**
1. Upload template
2. Upload dispatch
3. Generate reports
4. Download reports
5. Share to Dropbox

**Verify:**
- All files stored in Blob
- All database records have blob URLs
- All downloads work
- Dropbox sharing works

---

## Part 11: Rollout Plan

### 11.1 Pre-Deployment

1. **Set up Vercel Blob:**
   - Create Blob store in Vercel dashboard
   - Get `BLOB_READ_WRITE_TOKEN`
   - Add to environment variables

2. **Local Testing:**
   - Test with `USE_BLOB=true` locally
   - Verify all upload/download flows
   - Test error handling

3. **Staging Deployment:**
   - Deploy to Vercel preview
   - Test with real files
   - Monitor for errors

### 11.2 Deployment

1. **Deploy to Production:**
   - Merge code to main branch
   - Vercel auto-deploys
   - Monitor deployment logs

2. **Post-Deployment:**
   - Test critical flows (upload, generate, download)
   - Monitor error logs
   - Verify blob storage usage

### 11.3 Rollback Plan

**If issues arise:**
1. Revert to previous deployment
2. Files in Blob remain (no data loss)
3. Old filesystem paths still work (if accessible)
4. Fix issues and redeploy

---

## Part 12: Success Metrics

### 12.1 Functional Metrics

- ✅ All file uploads succeed
- ✅ All file downloads work
- ✅ All report generation succeeds
- ✅ Dropbox sharing works
- ✅ No data loss

### 12.2 Performance Metrics

- File upload time: < 2 seconds (for 10MB files)
- File download time: < 1 second (CDN)
- Report generation: No degradation
- Server load: Reduced (CDN handles downloads)

### 12.3 Reliability Metrics

- Zero file access failures
- Zero data loss incidents
- 99.9% uptime for file operations

---

## Part 13: Future Enhancements

### 13.1 File Versioning

**Current:** New files overwrite old ones
**Future:** Implement versioning in blob keys
- `uploads/ship-a/template_v1.xlsx`
- `uploads/ship-a/template_v2.xlsx`

### 13.2 File Cleanup

**Current:** Files persist indefinitely
**Future:** Implement retention policies
- Delete old reports after 90 days
- Archive templates after 1 year

### 13.3 Direct Upload

**Current:** Files upload through server
**Future:** Direct client-to-blob upload
- Generate signed URLs
- Client uploads directly
- Reduced server load

---

## Conclusion

This integration plan provides a comprehensive roadmap for migrating from filesystem-based storage to Vercel Blob Storage. The layered approach ensures minimal disruption while providing a production-ready, scalable file storage solution.

**Key Benefits:**
- ✅ Persistent storage in serverless environment
- ✅ CDN-backed fast downloads
- ✅ Ship-specific organization maintained
- ✅ Backward compatible with local development
- ✅ Production-ready error handling

**Estimated Timeline:** 3-4 days for full implementation and testing

**Risk Level:** Low (backward compatible, gradual migration)

