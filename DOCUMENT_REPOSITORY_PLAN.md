# Centralized Document Repository Plan

## Executive Summary

This plan outlines the implementation of a centralized, secured blob-storage based document repository for all generated reports (EOD, Dispatch, PAX, Consolidated PAX). The repository will provide unified document management, comprehensive audit trails, user tracking, and easy access/sharing capabilities. The architecture is designed with modularity in mind to enable easy migration to S3 or other storage providers in the future.

---

## 1. Objectives

### Primary Goals
1. **Unified Document Storage**: Centralize all generated documents (EOD, Dispatch, PAX, Consolidated PAX) in a single repository
2. **User Tracking**: Record who created/edited each document with timestamps
3. **Audit Trail**: Comprehensive logging for admin users to track document lifecycle
4. **Easy Access**: Filterable, searchable interface for document retrieval
5. **Sharing Integration**: Seamless integration with existing email/Dropbox sharing
6. **Storage Abstraction**: Modular design for easy migration to S3 or other providers

### Success Criteria
- All document types accessible from a single interface
- Complete audit trail for document creation, modification, and deletion
- Filterable by document type, date range, user, and ship
- User-friendly UI with document details and metadata
- Zero downtime migration from existing tables
- Storage provider can be swapped without code changes

---

## 2. Current State Analysis

### Existing Document Storage

#### Database Tables
1. **`generatedReports`**: Stores EOD reports
   - Fields: `id`, `dispatchFilePath`, `eodFilePath`, `shipId`, `recordCount`, `createdAt`
   - Missing: `userId`, `documentType`, `filename`, `fileSize`, `updatedAt`, `lastModifiedBy`

2. **`dispatchVersions`**: Stores dispatch sheet versions
   - Fields: `id`, `filename`, `originalFilename`, `filePath`, `shipId`, `version`, `description`, `createdAt`
   - Missing: `userId`, `documentType`, `fileSize`, `updatedAt`, `lastModifiedBy`

3. **`consolidatedPaxReports`**: Stores consolidated PAX reports
   - Fields: `id`, `filename`, `filePath`, `contributingShips`, `totalRecordCount`, `lastUpdatedByShip`, `createdAt`, `updatedAt`
   - Missing: `userId`, `documentType`, `fileSize`, `lastModifiedBy`

#### Current Issues
- **Fragmented Storage**: Documents stored across multiple tables
- **No User Tracking**: Cannot identify who created/edited documents
- **Incomplete Metadata**: Missing file size, document type, modification tracking
- **No Audit Trail**: Limited visibility into document lifecycle
- **Inconsistent Structure**: Different schemas for different document types
- **No Centralized Access**: Must query multiple tables to get all documents

---

## 3. Architecture Design

### 3.1 Storage Abstraction Layer

#### Interface: `IStorageProvider`
```typescript
interface IStorageProvider {
  // File operations
  uploadFile(buffer: Buffer, key: string, contentType: string, metadata?: Record<string, string>): Promise<StorageResult>;
  downloadFile(urlOrKey: string): Promise<Buffer>;
  deleteFile(urlOrKey: string): Promise<void>;
  getFileUrl(urlOrKey: string): Promise<string>;
  
  // Metadata operations
  getFileMetadata(urlOrKey: string): Promise<FileMetadata>;
  
  // Utility
  isStorageUrl(path: string): boolean;
  extractKeyFromUrl(url: string): string;
}

interface StorageResult {
  url: string;
  key: string;
  pathname?: string;
}

interface FileMetadata {
  size: number;
  contentType: string;
  lastModified: Date;
  metadata?: Record<string, string>;
}
```

#### Implementations
1. **`VercelBlobStorageProvider`**: Current implementation (wraps existing `BlobStorageService`)
2. **`S3StorageProvider`**: Future implementation for AWS S3
3. **`LocalStorageProvider`**: Development/testing implementation

#### Benefits
- **Modularity**: Easy to swap storage providers
- **Testing**: Can use local storage for development
- **Future-Proof**: Ready for S3 migration
- **Consistent API**: Same interface regardless of provider

---

### 3.2 Database Schema

#### New Table: `documentRepository`

```sql
CREATE TABLE document_repository (
  id SERIAL PRIMARY KEY,
  
  -- Document identification
  document_type TEXT NOT NULL, -- 'dispatch', 'eod', 'pax', 'consolidated-pax'
  filename TEXT NOT NULL,
  original_filename TEXT,
  file_path TEXT NOT NULL, -- Blob URL or storage key
  file_size INTEGER, -- Size in bytes
  content_type TEXT DEFAULT 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  
  -- Ship and versioning
  ship_id TEXT NOT NULL DEFAULT 'ship-a',
  version INTEGER DEFAULT 1,
  description TEXT,
  
  -- User tracking
  created_by_user_id INTEGER REFERENCES users(id),
  last_modified_by_user_id INTEGER REFERENCES users(id),
  
  -- Metadata
  metadata JSONB, -- Flexible JSON for document-specific data
  -- Examples:
  -- - For EOD: { recordCount: 10, dispatchFileId: 123 }
  -- - For PAX: { paxOnBoard: 500, paxOnTour: 400 }
  -- - For Consolidated PAX: { contributingShips: ["ship-a", "ship-b"], totalRecordCount: 50 }
  -- - For Dispatch: { tourName: "Blue Lagoon", departure: "09:00" }
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  deleted_at TIMESTAMP, -- Soft delete
  
  -- Indexes
  INDEX idx_document_type (document_type),
  INDEX idx_ship_id (ship_id),
  INDEX idx_created_by (created_by_user_id),
  INDEX idx_created_at (created_at),
  INDEX idx_document_type_ship (document_type, ship_id),
  INDEX idx_created_at_desc (created_at DESC)
);
```

#### Audit Log Table: `documentAuditLog`

```sql
CREATE TABLE document_audit_log (
  id SERIAL PRIMARY KEY,
  document_id INTEGER REFERENCES document_repository(id) ON DELETE CASCADE,
  
  -- Action details
  action TEXT NOT NULL, -- 'created', 'updated', 'downloaded', 'shared', 'deleted', 'restored'
  action_by_user_id INTEGER REFERENCES users(id),
  
  -- Changes
  changes JSONB, -- Before/after state for updates
  -- Example: { before: { filename: "old.xlsx" }, after: { filename: "new.xlsx" } }
  
  -- Sharing details (if action is 'shared')
  share_method TEXT, -- 'email', 'dropbox', 'both'
  recipients JSONB, -- Array of email addresses or Dropbox paths
  
  -- Metadata
  ip_address TEXT,
  user_agent TEXT,
  notes TEXT,
  
  -- Timestamp
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  
  -- Indexes
  INDEX idx_document_id (document_id),
  INDEX idx_action (action),
  INDEX idx_action_by (action_by_user_id),
  INDEX idx_created_at (created_at DESC)
);
```

#### Migration Strategy

**Phase 1: Parallel Writing**
- New documents written to both old tables AND `documentRepository`
- Existing code continues to work
- No breaking changes

**Phase 2: Data Migration**
- Script to migrate existing documents from old tables to `documentRepository`
- Preserve all metadata
- Link to users where possible

**Phase 3: Read Migration**
- Update read operations to use `documentRepository`
- Keep old tables for backward compatibility initially

**Phase 4: Deprecation**
- Mark old tables as deprecated
- Eventually remove (after sufficient time)

---

### 3.3 Service Layer

#### `DocumentRepositoryService`

```typescript
class DocumentRepositoryService {
  // Create document entry
  async createDocument(params: {
    documentType: 'dispatch' | 'eod' | 'pax' | 'consolidated-pax';
    filename: string;
    originalFilename?: string;
    filePath: string; // Blob URL
    fileSize: number;
    shipId: string;
    userId: number;
    metadata?: Record<string, any>;
    version?: number;
    description?: string;
  }): Promise<DocumentRecord>;

  // Get documents with filtering
  async getDocuments(filters: {
    documentType?: 'dispatch' | 'eod' | 'pax' | 'consolidated-pax';
    shipId?: string;
    userId?: number;
    dateFrom?: Date;
    dateTo?: Date;
    search?: string; // Search in filename, description
    limit?: number;
    offset?: number;
  }): Promise<{ documents: DocumentRecord[]; total: number }>;

  // Get single document
  async getDocument(id: number): Promise<DocumentRecord | null>;

  // Update document metadata
  async updateDocument(
    id: number,
    updates: {
      filename?: string;
      description?: string;
      metadata?: Record<string, any>;
    },
    userId: number
  ): Promise<DocumentRecord>;

  // Soft delete
  async deleteDocument(id: number, userId: number): Promise<void>;

  // Restore deleted document
  async restoreDocument(id: number, userId: number): Promise<DocumentRecord>;

  // Get audit log
  async getAuditLog(
    documentId?: number,
    filters?: {
      action?: string;
      userId?: number;
      dateFrom?: Date;
      dateTo?: Date;
    }
  ): Promise<AuditLogEntry[]>;

  // Log audit event
  async logAuditEvent(params: {
    documentId: number;
    action: string;
    userId: number;
    changes?: Record<string, any>;
    shareMethod?: string;
    recipients?: string[];
    ipAddress?: string;
    userAgent?: string;
    notes?: string;
  }): Promise<void>;
}
```

---

## 4. Implementation Plan

### Phase 1: Foundation (Week 1)

#### Task 1.1: Storage Abstraction Layer
- [ ] Create `IStorageProvider` interface
- [ ] Refactor `BlobStorageService` to implement `IStorageProvider`
- [ ] Create `VercelBlobStorageProvider` wrapper
- [ ] Create `StorageProviderFactory` for provider selection
- [ ] Update configuration to support provider selection via env var
- [ ] Write unit tests for storage abstraction

**Files to Create:**
- `server/services/storage/storage-provider.interface.ts`
- `server/services/storage/vercel-blob-provider.ts`
- `server/services/storage/s3-provider.ts` (stub for future)
- `server/services/storage/local-provider.ts` (for testing)
- `server/services/storage/storage-factory.ts`

**Files to Modify:**
- `server/services/blob-storage.ts` → Refactor to implement interface
- `server/config.ts` → Add `STORAGE_PROVIDER` env var

---

#### Task 1.2: Database Schema
- [ ] Create migration for `documentRepository` table
- [ ] Create migration for `documentAuditLog` table
- [ ] Add Drizzle schema definitions
- [ ] Create TypeScript types for new tables
- [ ] Run migration on development database
- [ ] Verify schema in production database

**Files to Create:**
- `server/migrations/XXXX_create_document_repository.sql`
- `server/migrations/XXXX_create_document_audit_log.sql`
- `shared/schema.ts` → Add new table definitions

**Files to Modify:**
- `shared/schema.ts` → Add `documentRepository` and `documentAuditLog` tables
- `server/db.ts` → Ensure migrations are run

---

#### Task 1.3: Service Layer - Core
- [ ] Create `DocumentRepositoryService` class
- [ ] Implement `createDocument` method
- [ ] Implement `getDocument` method
- [ ] Implement `getDocuments` with filtering
- [ ] Implement `updateDocument` method
- [ ] Implement `deleteDocument` (soft delete)
- [ ] Implement `restoreDocument` method
- [ ] Write unit tests

**Files to Create:**
- `server/services/document-repository.service.ts`
- `server/services/document-repository.service.test.ts`

**Files to Modify:**
- `server/storage.ts` → Add methods to `IStorage` interface
- `server/storage.ts` → Implement methods in `DatabaseStorage`

---

### Phase 2: Audit Trail (Week 1-2)

#### Task 2.1: Audit Logging Service
- [ ] Create `AuditLogService` class
- [ ] Implement `logAuditEvent` method
- [ ] Implement `getAuditLog` with filtering
- [ ] Integrate with `DocumentRepositoryService`
- [ ] Add audit logging to all document operations
- [ ] Write unit tests

**Files to Create:**
- `server/services/audit-log.service.ts`
- `server/services/audit-log.service.test.ts`

**Files to Modify:**
- `server/services/document-repository.service.ts` → Integrate audit logging

---

#### Task 2.2: Audit Log API Endpoints
- [ ] `GET /api/documents/:id/audit-log` - Get audit log for a document
- [ ] `GET /api/audit-log` - Get system-wide audit log (admin only)
- [ ] Add authentication and authorization checks
- [ ] Add filtering and pagination
- [ ] Write API tests

**Files to Modify:**
- `server/routes.ts` → Add audit log endpoints

---

### Phase 3: API Integration (Week 2)

#### Task 3.1: Document Repository API Endpoints
- [ ] `GET /api/documents` - List documents with filtering
  - Query params: `type`, `shipId`, `userId`, `dateFrom`, `dateTo`, `search`, `limit`, `offset`
- [ ] `GET /api/documents/:id` - Get single document
- [ ] `POST /api/documents` - Create document (internal use, called by report generators)
- [ ] `PATCH /api/documents/:id` - Update document metadata
- [ ] `DELETE /api/documents/:id` - Soft delete document
- [ ] `POST /api/documents/:id/restore` - Restore deleted document
- [ ] `GET /api/documents/:id/download` - Download document
- [ ] `GET /api/documents/:id/share` - Share document (integrate with existing sharing)
- [ ] Add authentication and authorization
- [ ] Add input validation
- [ ] Write API tests

**Files to Modify:**
- `server/routes.ts` → Add document repository endpoints

---

#### Task 3.2: Integrate with Report Generators
- [ ] Update EOD report generation to create document entry
- [ ] Update PAX report generation to create document entry
- [ ] Update Consolidated PAX generation to create document entry
- [ ] Update Dispatch version creation to create document entry
- [ ] Ensure all document creations log audit events
- [ ] Test end-to-end document creation flow

**Files to Modify:**
- `server/routes.ts` → Update report generation endpoints
  - `/api/process-eod-from-dispatch`
  - `/api/generate-pax-report`
  - `/api/update-pax-report`
  - `/api/consolidated-pax/generate`
  - `/api/dispatch-versions` (dispatch save)

---

### Phase 4: Frontend UI (Week 2-3)

#### Task 4.1: Document Repository Page
- [ ] Create `document-repository.tsx` page
- [ ] Implement document list with table view
- [ ] Add filtering UI (type, ship, date range, user)
- [ ] Add search functionality
- [ ] Add pagination
- [ ] Display document metadata (filename, type, ship, user, date, size)
- [ ] Add action buttons (download, share, view details, delete)
- [ ] Add loading states and error handling
- [ ] Make it responsive

**Files to Create:**
- `client/src/pages/document-repository.tsx`
- `client/src/components/document-repository/` (if needed)

**Files to Modify:**
- `client/src/App.tsx` → Add route for document repository
- `client/src/components/sidebar.tsx` → Add navigation link

---

#### Task 4.2: Document Details Modal/Page
- [ ] Create document details view
- [ ] Display full document metadata
- [ ] Show audit log for the document
- [ ] Add edit metadata functionality
- [ ] Add download and share buttons
- [ ] Show file preview (if applicable)

**Files to Create:**
- `client/src/components/document-details.tsx` (or modal)

---

#### Task 4.3: Audit Log View (Admin Only)
- [ ] Create audit log page
- [ ] Display audit log entries in table
- [ ] Add filtering (document, user, action, date range)
- [ ] Show action details and changes
- [ ] Add export functionality (CSV/Excel)
- [ ] Restrict access to admin users only

**Files to Create:**
- `client/src/pages/audit-log.tsx`

**Files to Modify:**
- `client/src/App.tsx` → Add route (admin only)
- `client/src/components/sidebar.tsx` → Add navigation link (admin only)

---

### Phase 5: Data Migration (Week 3)

#### Task 5.1: Migration Script
- [ ] Create migration script to move data from old tables to `documentRepository`
- [ ] Map existing fields to new schema
- [ ] Handle missing user IDs (set to null or system user)
- [ ] Preserve all metadata
- [ ] Create audit log entries for migrated documents
- [ ] Add dry-run mode
- [ ] Add rollback capability
- [ ] Test on development database

**Files to Create:**
- `server/scripts/migrate-documents.ts`
- `server/scripts/migrate-documents.test.ts`

---

#### Task 5.2: Parallel Writing
- [ ] Update all report generators to write to both old tables AND `documentRepository`
- [ ] Ensure backward compatibility
- [ ] Test document creation in both locations
- [ ] Monitor for any issues

**Files to Modify:**
- `server/routes.ts` → All report generation endpoints

---

#### Task 5.3: Data Migration Execution
- [ ] Run migration script on production database
- [ ] Verify data integrity
- [ ] Compare counts between old and new tables
- [ ] Fix any data issues
- [ ] Document migration results

---

### Phase 6: Testing & Validation (Week 3-4)

#### Task 6.1: Unit Tests
- [ ] Test `DocumentRepositoryService`
- [ ] Test `AuditLogService`
- [ ] Test storage providers
- [ ] Test API endpoints
- [ ] Achieve >80% code coverage

---

#### Task 6.2: Integration Tests
- [ ] Test document creation flow
- [ ] Test document retrieval with filters
- [ ] Test audit logging
- [ ] Test sharing integration
- [ ] Test soft delete and restore

---

#### Task 6.3: End-to-End Tests
- [ ] Test complete document lifecycle
- [ ] Test user workflows
- [ ] Test admin audit log access
- [ ] Test error scenarios

---

#### Task 6.4: Performance Testing
- [ ] Test with large document sets (1000+ documents)
- [ ] Test filtering performance
- [ ] Test pagination performance
- [ ] Optimize slow queries
- [ ] Add database indexes if needed

---

### Phase 7: Documentation & Deployment (Week 4)

#### Task 7.1: Documentation
- [ ] Document API endpoints
- [ ] Document database schema
- [ ] Document migration process
- [ ] Create user guide for document repository
- [ ] Create admin guide for audit logs

**Files to Create:**
- `docs/document-repository-api.md`
- `docs/document-repository-user-guide.md`
- `docs/audit-log-admin-guide.md`

---

#### Task 7.2: Deployment
- [ ] Deploy to staging environment
- [ ] Run migration on staging
- [ ] Test all functionality on staging
- [ ] Deploy to production
- [ ] Run migration on production
- [ ] Monitor for issues
- [ ] Create rollback plan

---

## 5. Technical Specifications

### 5.1 Database Schema Details

#### `documentRepository` Table
```typescript
{
  id: number;
  documentType: 'dispatch' | 'eod' | 'pax' | 'consolidated-pax';
  filename: string;
  originalFilename?: string;
  filePath: string; // Blob URL
  fileSize?: number;
  contentType: string;
  shipId: string;
  version: number;
  description?: string;
  createdByUserId?: number;
  lastModifiedByUserId?: number;
  metadata: Record<string, any>; // JSONB
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}
```

#### `documentAuditLog` Table
```typescript
{
  id: number;
  documentId: number;
  action: 'created' | 'updated' | 'downloaded' | 'shared' | 'deleted' | 'restored';
  actionByUserId?: number;
  changes?: Record<string, any>; // JSONB
  shareMethod?: 'email' | 'dropbox' | 'both';
  recipients?: string[]; // JSONB
  ipAddress?: string;
  userAgent?: string;
  notes?: string;
  createdAt: Date;
}
```

---

### 5.2 API Endpoints

#### Document Management
```
GET    /api/documents                    # List documents (with filters)
GET    /api/documents/:id                # Get single document
POST   /api/documents                    # Create document (internal)
PATCH  /api/documents/:id                # Update document
DELETE /api/documents/:id                # Soft delete document
POST   /api/documents/:id/restore        # Restore deleted document
GET    /api/documents/:id/download       # Download document
GET    /api/documents/:id/share          # Share document
```

#### Audit Log
```
GET    /api/documents/:id/audit-log      # Get audit log for document
GET    /api/audit-log                    # Get system audit log (admin)
```

---

### 5.3 Frontend Components

#### Document Repository Page
- **Filters Panel**: Document type, ship, date range, user, search
- **Document Table**: Columns: Type, Filename, Ship, Created By, Date, Size, Actions
- **Pagination**: Page size selector, page navigation
- **Actions**: Download, Share, View Details, Delete, Restore

#### Document Details Modal
- **Metadata Display**: All document information
- **Audit Log**: Recent audit entries
- **Actions**: Edit, Download, Share

#### Audit Log Page (Admin)
- **Filters**: Document, user, action, date range
- **Audit Table**: Action, User, Document, Timestamp, Details
- **Export**: CSV/Excel export

---

## 6. Security Considerations

### 6.1 Access Control
- **Authentication**: All endpoints require valid JWT token
- **Authorization**: 
  - Regular users: Can view, download, share their own documents
  - Admin users: Can view all documents, access audit logs
  - Superusers: Full access including hard delete

### 6.2 Data Protection
- **Soft Delete**: Documents are soft-deleted, not permanently removed
- **Audit Trail**: All actions are logged, cannot be deleted
- **File Access**: Blob URLs are public but time-limited (if possible)
- **Input Validation**: All inputs validated and sanitized

### 6.3 Privacy
- **User Data**: User IDs stored, but usernames displayed in UI
- **IP Logging**: Optional, can be disabled via config
- **Audit Log Retention**: Configurable retention period

---

## 7. Migration to S3 (Future)

### 7.1 S3 Provider Implementation
- [ ] Create `S3StorageProvider` class implementing `IStorageProvider`
- [ ] Configure AWS SDK
- [ ] Implement all interface methods
- [ ] Add S3-specific configuration (bucket, region, credentials)
- [ ] Test S3 provider in development

### 7.2 Migration Process
1. **Dual Writing**: Write to both Vercel Blob and S3
2. **Data Migration**: Copy all existing files from Vercel Blob to S3
3. **URL Update**: Update `filePath` in database to S3 URLs
4. **Switch Provider**: Change `STORAGE_PROVIDER` env var to `s3`
5. **Verification**: Test all operations with S3
6. **Cleanup**: Remove Vercel Blob files (optional)

### 7.3 Configuration
```typescript
// config.ts
STORAGE_PROVIDER: 'vercel-blob' | 's3' | 'local'
AWS_S3_BUCKET: string
AWS_S3_REGION: string
AWS_ACCESS_KEY_ID: string
AWS_SECRET_ACCESS_KEY: string
```

---

## 8. Success Metrics

### Functional Metrics
- ✅ All document types stored in repository
- ✅ 100% of document operations logged in audit trail
- ✅ Filtering and search working for all document types
- ✅ Zero data loss during migration

### Performance Metrics
- ✅ Document list loads in <2 seconds (100 documents)
- ✅ Filtering responds in <500ms
- ✅ Audit log queries complete in <1 second

### User Experience Metrics
- ✅ Document repository accessible from main navigation
- ✅ Intuitive filtering and search
- ✅ Clear document metadata display
- ✅ Easy download and sharing

---

## 9. Risk Mitigation

### Risks and Mitigation Strategies

1. **Data Loss During Migration**
   - **Mitigation**: Parallel writing, comprehensive backups, dry-run testing

2. **Performance Issues with Large Datasets**
   - **Mitigation**: Proper indexing, pagination, query optimization

3. **Breaking Changes to Existing Functionality**
   - **Mitigation**: Parallel writing, gradual migration, backward compatibility

4. **Storage Provider Lock-in**
   - **Mitigation**: Storage abstraction layer, easy provider swapping

5. **Audit Log Growth**
   - **Mitigation**: Configurable retention, archiving strategy, pagination

---

## 10. Timeline Summary

| Phase | Duration | Key Deliverables |
|-------|----------|------------------|
| Phase 1: Foundation | Week 1 | Storage abstraction, database schema, core service |
| Phase 2: Audit Trail | Week 1-2 | Audit logging service and API |
| Phase 3: API Integration | Week 2 | Document repository API, report generator integration |
| Phase 4: Frontend UI | Week 2-3 | Document repository page, audit log view |
| Phase 5: Data Migration | Week 3 | Migration script, parallel writing, data migration |
| Phase 6: Testing | Week 3-4 | Unit, integration, E2E, performance tests |
| Phase 7: Documentation & Deployment | Week 4 | Documentation, staging deployment, production deployment |

**Total Estimated Time**: 4 weeks

---

## 11. Next Steps

1. **Review and Approve Plan**: Get stakeholder approval
2. **Set Up Development Environment**: Prepare for Phase 1
3. **Create Project Board**: Track tasks and progress
4. **Begin Phase 1**: Start with storage abstraction layer
5. **Regular Check-ins**: Weekly progress reviews

---

## Appendix A: File Structure

```
server/
├── services/
│   ├── storage/
│   │   ├── storage-provider.interface.ts
│   │   ├── vercel-blob-provider.ts
│   │   ├── s3-provider.ts (future)
│   │   ├── local-provider.ts
│   │   └── storage-factory.ts
│   ├── document-repository.service.ts
│   ├── audit-log.service.ts
│   └── blob-storage.ts (refactored)
├── migrations/
│   ├── XXXX_create_document_repository.sql
│   └── XXXX_create_document_audit_log.sql
├── scripts/
│   └── migrate-documents.ts
└── routes.ts (modified)

client/src/
├── pages/
│   ├── document-repository.tsx
│   └── audit-log.tsx
└── components/
    └── document-details.tsx

shared/
└── schema.ts (modified)

docs/
├── document-repository-api.md
├── document-repository-user-guide.md
└── audit-log-admin-guide.md
```

---

## Appendix B: Example API Responses

### GET /api/documents
```json
{
  "documents": [
    {
      "id": 1,
      "documentType": "eod",
      "filename": "eod_report_1234567890.xlsx",
      "originalFilename": "EOD Report - Ship A.xlsx",
      "filePath": "https://...blob.vercel-storage.com/...",
      "fileSize": 45678,
      "contentType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "shipId": "ship-a",
      "version": 1,
      "description": "EOD report for 2024-01-15",
      "createdBy": {
        "id": 5,
        "username": "john.doe",
        "firstName": "John",
        "lastName": "Doe"
      },
      "lastModifiedBy": {
        "id": 5,
        "username": "john.doe",
        "firstName": "John",
        "lastName": "Doe"
      },
      "metadata": {
        "recordCount": 10,
        "dispatchFileId": 123
      },
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:30:00Z",
      "deletedAt": null
    }
  ],
  "total": 150,
  "limit": 20,
  "offset": 0
}
```

### GET /api/documents/1/audit-log
```json
{
  "auditLog": [
    {
      "id": 1,
      "documentId": 1,
      "action": "created",
      "actionBy": {
        "id": 5,
        "username": "john.doe",
        "firstName": "John",
        "lastName": "Doe"
      },
      "changes": null,
      "createdAt": "2024-01-15T10:30:00Z"
    },
    {
      "id": 2,
      "documentId": 1,
      "action": "shared",
      "actionBy": {
        "id": 5,
        "username": "john.doe",
        "firstName": "John",
        "lastName": "Doe"
      },
      "shareMethod": "email",
      "recipients": ["manager@example.com"],
      "createdAt": "2024-01-15T11:00:00Z"
    }
  ]
}
```

---

**End of Plan**









