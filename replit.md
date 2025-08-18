# Excel Data Processing Application

## Overview

This is a full-stack web application for uploading, processing, and exporting Excel files with template-based document generation. The system allows users to upload Excel files, preview the data, select processing templates, and export results. The project aims to streamline document creation, enhance data management, and provide robust reporting capabilities for businesses, with a vision for future ship-specific data management.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React with TypeScript
- **Styling**: Tailwind CSS with shadcn/ui
- **State Management**: TanStack Query
- **Routing**: Wouter
- **Build Tool**: Vite
- **UI/UX Decisions**: Modern gradient headers, 4-step workflow visualization, interactive upload progress, celebration sections, color-coded sections, professional layouts, responsive sidebar navigation with content shifting, professional user and template management interfaces, spreadsheet view with in-browser editing.

### Backend
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **File Upload**: Multer
- **Excel Processing**: ExcelJS (for robust formatting preservation), xlsx (for initial parsing)
- **Template Engine**: Handlebars for general templates, custom ExcelJS-based template processing for EOD reports.

### Database
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Database**: PostgreSQL (configured for Neon serverless)
- **Schema**: Supports file management, processing tracking, and user management.

### Core Features
- **File Upload System**: Drag-and-drop interface with validation.
- **Data Processing Pipeline**: Involves file storage, Excel parsing, database storage of parsed data, template application, and export.
- **Template System**: Supports dynamic data insertion, complex formatting preservation (merged cells, colors, borders, fonts, text wrapping), and calculations.
- **EOD Report Generation**: Extracts specific data from dispatch sheets and populates a detailed EOD template, including dynamic row creation and accurate totals.
- **Dispatch Sheet Generation**: Generates new dispatch sheets while preserving original template formatting.
- **Report Management**: Automatic dual report (dispatch and EOD) generation with downloadable files and processing history.
- **User Management**: Comprehensive user management with details, status, and actions.
- **Spreadsheet View**: In-browser Excel editing capabilities (upload, edit, save, download).
- **Auto-Calculations**: Real-time calculation for fields like "Total Guests".
- **Responsive Design**: Global sidebar for navigation and responsive layouts.
- **Successive Report Generation**: Ability to append new records to existing reports, e.g., PAX reports.
- **Header Data Preservation**: Ensures original template header data (e.g., ship name, date) is correctly extracted and preserved during saves and report generation.
- **Date Formatting**: Consistent DD/MM/YYYY date formatting in reports.

### System Design Choices
- **Ship-Agnostic Workflow**: Designed for eventual implementation of ship-specific data management, requiring future database schema modifications (e.g., `ship_id` columns), file system changes (ship-specific subdirectories), and API endpoint modifications.
- **Version Control**: Tracks all saved dispatch sheet edits in `dispatch_versions` table.
- **Modular Processors**: Uses dedicated processors (e.g., `cellExtractor`, `simpleEODProcessor`, `PAXProcessor`) for distinct data extraction and processing tasks.

## External Dependencies

- **Database**: @neondatabase/serverless, drizzle-orm
- **UI Components**: @radix-ui/* components, lucide-react icons, shadcn/ui
- **File Processing**: multer, xlsx, exceljs, react-dropzone
- **Template Engine**: handlebars
- **State Management**: @tanstack/react-query
- **Styling**: tailwindcss, class-variance-authority
- **Spreadsheet Editor**: handsontable
- **Cloud Storage**: Dropbox API (for file upload and storage)

## Complete Data Flow Documentation (January 4, 2025)

### Current System Overview - Ship-Agnostic Workflow
**Purpose:** Document the existing dispatch-to-reports pipeline for future ship-specific implementation

#### Phase 1: Template Management & Initial Setup

**1.1 Template Storage System:**
- **Dispatch Templates:** Single active template stored in `dispatch_templates` table
- **EOD Templates:** Single active template stored in `eod_templates` table  
- **PAX Templates:** Single active template stored in `pax_templates` table
- **File Storage:** All templates stored in `uploads/` directory with database metadata

**1.2 Template Loading Process:**
- Frontend: `CreateDispatch` component queries `/api/dispatch-templates`
- Backend: `storage.getActiveDispatchTemplate()` retrieves current active template
- Display: Template loaded into Handsontable for in-browser editing

#### Phase 2: Dispatch Sheet Editing & Data Persistence

**2.1 Edit Workflow:**
```
User clicks "Edit Dispatch Sheet" 
→ Handsontable displays Excel content for editing
→ User modifies cells (tour data, header info, guest counts)
→ User clicks "Save Changes"
→ Frontend uploads edited data via `/api/save-dispatch-sheet`
```

**2.2 Save Process (POST /api/save-dispatch-sheet):**
- **Formatting Preservation:** ExcelJS loads original template + edited data
- **Header Processing:** Rows 1-7 copied first (cruise line B1, ship name B2, date B4)  
- **Data Processing:** Rows 8+ copied (tour information, guest counts)
- **File Creation:** New timestamped file saved as `edited_dispatch_[timestamp].xlsx`
- **Database Record:** `dispatch_versions` table stores version metadata

#### Phase 3: EOD Report Generation - CRITICAL DUAL FUNCTIONALITY

**🔴 NEW EOD Report Generation:**
```
User clicks "Generate New EOD Report"
→ Frontend POST to `/api/process-eod-from-dispatch`
→ Backend creates FRESH EOD report from blank template
→ Uses simpleEODProcessor.processMultipleRecords()
→ Creates `eod_[timestamp].xlsx` in `output/` directory
→ RESULT: Brand new EOD report with current dispatch data
```

**🔵 SUCCESSIVE EOD Report (Add to Existing):**
```
User clicks "Update Existing EOD Report" 
→ Frontend POST to `/api/add-successive-eod-entry`
→ Backend finds LATEST existing EOD report in output/
→ Uses simpleEODProcessor.addSuccessiveDispatchEntry()
→ APPENDS new tour sections to existing report
→ Shifts totals section down, updates calculations
→ RESULT: Existing EOD report with additional tour data
```

**3.1 Critical Distinction - EOD Processing:**
- **NEW Report:** `processMultipleRecords()` - starts with blank EOD template
- **SUCCESSIVE Report:** `addSuccessiveDispatchEntry()` - loads existing EOD + appends new data
- **Row Management:** Successive processing inserts new rows and shifts totals section
- **Data Preservation:** Successive maintains all previous tour data + adds new tours

#### Phase 4: PAX Report Generation - CRITICAL DUAL FUNCTIONALITY

**🔴 NEW PAX Report Generation:**
```
User clicks "Generate New PAX Report"
→ Frontend POST to `/api/process-pax-from-dispatch` 
→ Backend creates FRESH PAX report from blank template
→ Uses paxProcessor.processDispatchToPax()
→ Creates `pax_[timestamp].xlsx` in `output/` directory
→ RESULT: Brand new PAX report with current dispatch data
```

**🔵 SUCCESSIVE PAX Report (Add to Existing):**
```
User clicks "Update Existing PAX Report"
→ Frontend POST to `/api/add-successive-pax-entry`
→ Backend finds LATEST existing PAX report in output/
→ Uses paxProcessor.addSuccessiveEntry()
→ APPENDS new tour data to existing report
→ Updates totals and calculations
→ RESULT: Existing PAX report with additional tour data
```

**4.1 PAX Processing Pipeline (Both Types):**
- **Validation Layer:** Only processes tours matching exact names:
  - "Catamaran Sail & Snorkel" → `{{cat_sold}}`, `{{cat_allot}}`
  - "Champagne Adults Only" → `{{champ_sold}}`, `{{champ_allot}}`
  - "Invisible Boat Family" → `{{inv_sold}}`, `{{inv_allot}}`
- **Data Extraction:** Header data (B1, B2, B4) + tour-specific data (H=allotment, J=sold)
- **Critical Difference:** NEW uses blank template, SUCCESSIVE appends to existing

#### Phase 5: File Management & Downloads

**5.1 Output File System:**
- **Storage Location:** All reports saved to `output/` directory
- **File API:** `/api/output/:filename` serves files with proper headers
- **File Listing:** `/api/output-files` returns metadata for reports page

**5.2 Version Management:**
- **Dispatch Versions:** `dispatch_versions` table tracks all saved edits
- **Report Types:** NEW creates fresh files, SUCCESSIVE modifies existing files
- **Latest Logic:** Both NEW and SUCCESSIVE use latest dispatch version as data source

### Critical Data Flow Points for Ship-Specific Implementation

**1. Template Loading:** Currently loads single active template - needs ship-specific template selection
**2. Data Storage:** All dispatch versions stored globally - needs ship-based partitioning  
**3. File Paths:** No ship identifier in file naming or directory structure
**4. Report Generation:** Uses latest dispatch version globally - needs ship-specific latest version
**5. NEW vs SUCCESSIVE:** Both functionalities must be preserved per ship
**6. Navigation State:** No persistence of selected ship between sessions

### Database Schema Impact Analysis

**Current Tables Requiring Ship Context:**
- `dispatch_templates` → Add `ship_id` column
- `eod_templates` → Add `ship_id` column  
- `pax_templates` → Add `ship_id` column
- `dispatch_versions` → Add `ship_id` column
- `generated_reports` → Add `ship_id` column
- `processing_jobs` → Add `ship_id` column

**File System Changes Needed:**
- Ship-specific subdirectories: `uploads/ship-a/`, `output/ship-a/`
- Modified file naming: `ship-a_dispatch_[timestamp].xlsx`
- Template organization by ship
- SUCCESSIVE report logic must find latest report PER SHIP

**API Endpoint Modifications Required:**
- Ship parameter in template loading: `/api/dispatch-templates?ship=a`
- Ship-specific file serving: `/api/files/ship-a/[filename]`
- Ship context in report generation endpoints
- Ship-specific SUCCESSIVE report finding: latest EOD/PAX per ship

**🚨 CRITICAL FUNCTIONALITY TO PRESERVE:**
1. **NEW Report Generation:** Must always create fresh reports from templates
2. **SUCCESSIVE Report Processing:** Must always append to existing reports  
3. **Ship Isolation:** Each ship's SUCCESSIVE processing must only find its own latest reports
4. **Data Integrity:** NEW vs SUCCESSIVE distinction must be maintained per ship

**Status:** ✅ Complete workflow documented with NEW vs SUCCESSIVE functionality clearly defined