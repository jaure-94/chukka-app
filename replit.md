# Excel Data Processing Application

## Overview

This is a full-stack web application for uploading, processing, and exporting Excel files with template-based document generation. The system allows users to upload Excel files, preview the data, select processing templates, and export results to Dropbox. The project aims to streamline document creation, enhance data management, and provide robust reporting capabilities for businesses.

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
- **Template Engine**: Handlebars for document generation (initially), custom ExcelJS-based template processing for EOD reports.

### Database
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Database**: PostgreSQL (configured for Neon serverless)
- **Schema**: Supports file management, processing tracking, and user management.

### Key Features
- **File Upload System**: Drag-and-drop interface with validation for Excel formats (.xlsx, .xls) and size limits.
- **Data Processing Pipeline**: Involves file storage, Excel parsing, database storage of parsed data, template application, and Dropbox export.
- **Template System**: Handlebars-based for general templates, and a specialized ExcelJS-based system for EOD templates, supporting dynamic data insertion, complex formatting preservation (merged cells, colors, borders, fonts, text wrapping), and calculations.
- **EOD Report Generation**: Comprehensive system to extract specific data (tour names, adult/child/comp counts, departure times, notes) from dispatch sheets and populate a detailed EOD template, including dynamic row creation for multiple tours and accurate totals.
- **Dispatch Sheet Generation**: System to generate new dispatch sheets, preserving original template formatting.
- **Report Management**: Automatic dual report (dispatch and EOD) generation upon new dispatch record creation, with downloadable files and processing history.
- **User Management**: Comprehensive users page with user details, status, and management actions.
- **Spreadsheet View**: In-browser Excel editing capabilities using Handsontable, allowing upload, edit, save, and download of spreadsheets.
- **Date/Time Selection**: Redesigned date picker with separate date and time selection.
- **Auto-Calculations**: Real-time calculation for fields like "Total Guests".
- **Responsive Design**: Global sidebar for navigation, content shifting, and responsive layouts across all pages.

## Important Template Structure Changes (Latest Update)

### Dispatch Template Structure Changes:
**Date:** January 4, 2025

**Critical Changes Made to Dispatch Template:**
1. **Column C8 Header Change**: Changed from "Actual Dep" to "Return Tour Time"
2. **Column E Deletion**: Removed column E which contained "(Armband)" subheading
3. **Column Shift Impact**: All columns from F onwards have shifted left by one position:
   - Original column F → Now column E
   - Original column G → Now column F
   - Original column H → Now column G
   - ...and so on
   - Original column S → Now column R (last column)

**Key Column Positions After Changes:**
- **ADULT**: Column K (unchanged)
- **CHILD**: Column L (unchanged) 
- **COMP**: Column M (unchanged)
- **Notes**: Column N (unchanged)

*Note: These important data columns maintained their positions because the deleted column E was before them.*

**IMPORTANT:** These changes will require updates to the EOD report generation functionality, specifically:
- Cell extraction logic in cell-extractor.ts
- Column mapping in EOD processors
- Any hardcoded column references throughout the system

**Status:** ✅ Changes documented and implemented - ship name extraction fixed in both PAX and EOD systems

## PAX Report Template Structure (Latest Update)

### Template Layout Analysis:
**Date:** January 4, 2025

**PAX Template Structure:**
1. **Row 1**: Empty
2. **Row 2**: Main headers with merged tour name columns:
   - A: "DATE", B: "LINE", C: "SHIP NAME"
   - D-E: "Catamaran Sail & Snorkel" (merged)
   - F-G: "Champagne Adults Only" (merged) 
   - H-I: "Invisible Boat Family" (merged)
   - BR-BX: "PAX TOTALS, ANALYSIS and RATES" (merged)

3. **Row 3**: Subheadings with Sold/Allotment pairs:
   - D: "Sold", E: "Allotment" (Catamaran)
   - F: "Sold", G: "Allotment" (Champagne)
   - H: "Sold", I: "Allotment" (Invisible Boat)
   - Analysis columns: BR-BX with rate calculations

4. **Row 4**: **CRITICAL DELIMITER ROW** for data replacement:
   - A: `{{date}}`, B: `{{cruise_line}}`, C: `{{ship_name}}`
   - D: `{{cat_sold}}`, E: `{{cat_allot}}`
   - F: `{{champ_sold}}`, G: `{{champ_allot}}`
   - H: `{{inv_sold}}`, I: `{{inv_allot}}`
   - BT: `{{pax_on_board}}`, BU: `{{pax_on_tour}}`

**Key Implementation Notes:**
- Row 4 serves as the template row for data population
- Each tour has a Sold/Allotment pair in consecutive columns
- Analysis columns (BR-BX) contain summary calculations
- Template supports 3 main tours: Catamaran, Champagne Adults Only, Invisible Boat Family

**Status:** Template structure documented - ready for PAX generation implementation

## PAX Report Generation Logic (Latest Update)

### Delimiter Replacement Logic:
**Date:** January 4, 2025

**Validation Layer Requirements:**
- Tour names in dispatch sheet must match exactly one of:
  - "Catamaran Sail & Snorkel"
  - "Champagne Adults Only"
  - "Invisible Boat Family"
- Only validated records are processed for PAX report generation

**Direct Cell Mapping (Always Applied):**
- `{{date}}` ← Dispatch Cell B4 (date)
- `{{cruise_line}}` ← Dispatch Cell B1 (cruise line)
- `{{ship_name}}` ← Dispatch Cell B2 (ship name)

**Conditional Column Mapping (Tour Name Based):**
- **Dispatch Column H (ALLOTMENT)** → PAX delimiters:
  - `{{cat_allot}}` if tour = "Catamaran Sail & Snorkel"
  - `{{champ_allot}}` if tour = "Champagne Adults Only"
  - `{{inv_allot}}` if tour = "Invisible Boat Family"

- **Dispatch Column J (SOLD)** → PAX delimiters:
  - `{{cat_sold}}` if tour = "Catamaran Sail & Snorkel"
  - `{{champ_sold}}` if tour = "Champagne Adults Only"
  - `{{inv_sold}}` if tour = "Invisible Boat Family"

**Universal Record Mapping:**
- Dispatch Column Q (PAX ON BOARD) → `{{pax_on_board}}`
- Dispatch Column R (PAX ON TOUR) → `{{pax_on_tour}}`

**Implementation Notes:**
- Row 4 serves as template row for data population
- Each validated dispatch record creates a new row in PAX report
- Tour-specific data only populates corresponding delimiter columns
- Analysis columns (BR-BX) contain summary calculations

**Status:** ✅ PAX processor implemented and fully functional

## PAX Report Successive Records Implementation (Latest Update)

### Features Completed:
**Date:** January 4, 2025

**PAX Report Enhancement:**
1. **Dual Button System**: 
   - "Generate New PAX Report": Creates fresh PAX report (replaces template row 4)
   - "Update Existing PAX Report": Adds successive records as new rows to latest existing PAX report
2. **Backend Implementation**: New `/api/add-successive-pax-entry` endpoint
3. **PaxProcessor Enhancement**: Added `addSuccessiveEntryToPax()` method for row-by-row additions
4. **Data Flow**: Both buttons use same modal success functionality with navigation options
5. **File Management**: System automatically finds latest PAX report and appends new data below existing records

**Technical Implementation:**
- Frontend: Two-button PAX Template card with consistent styling and modal behavior
- Backend: Automatic PAX file detection, template row formatting preservation, proper data extraction
- Data Integrity: Same validation and mapping logic as original PAX generation
- File Output: New timestamped files for each successive addition to maintain audit trail

**Status:** ✅ Fully implemented and tested - both new and successive PAX generation working correctly

## PAX Report Functionality (Latest Update)

### Implementation Completed:
**Date:** January 4, 2025

**PAX Report Generation Features:**
1. **Button Location**: "Update PAX Report" button located in Create New Record page alongside "Update EOD Report" button
2. **Success Modal**: Displays success confirmation with navigation options to Reports page or stay on current page
3. **Delimiter Replacement**: Correctly replaces all template delimiters with actual dispatch data:
   - `{{date}}`, `{{cruise_line}}`, `{{ship_name}}` from dispatch header cells
   - `{{cat_sold}}`, `{{cat_allot}}`, `{{champ_sold}}`, `{{champ_allot}}`, `{{inv_sold}}`, `{{inv_allot}}` based on validated tour data
   - `{{pax_on_board}}`, `{{pax_on_tour}}` from dispatch summary columns
4. **Data Validation**: Tour names validated against exact matches before processing
5. **Single Row Output**: All data correctly entered into single template row (row 4) with proper formatting

**Technical Implementation:**
- PAX processor works directly with template row 4 for delimiter replacement
- Proper validation and mapping of tour types to corresponding PAX columns
- Complete integration with frontend success modal and navigation
- File type detection and display in Reports page with orange color coding

**Status:** ✅ Fully implemented and tested - PAX reports generating correctly

## Ship Name Data Fix (Latest Update)

### Issue Resolution:
**Date:** January 6, 2025

**Problem Identified:** PAX and EOD reports were reading ship names from incorrect cell location:
- **Incorrect:** Cell B2 contained static template value "Liberty" 
- **Correct:** Cell E2 contains actual dropdown selection value "Amber Cove"

**Technical Fix Applied:**
1. **PaxProcessor:** Updated ship name extraction from `getCellValue(worksheet, 'B2')` to `getCellValue(worksheet, 'E2')`
2. **CellExtractor:** Updated ship name extraction in `extractMultipleRecords()` to read from E2 instead of B2
3. **Verification:** Both PAX and EOD systems now correctly capture dropdown-selected ship names

**Validation Results:**
- **Before Fix:** All reports showed "Liberty" (static template value)
- **After Fix:** Reports correctly show "Amber Cove" (user's dropdown selection)
- **Data Flow:** Ship name changes in dispatch spreadsheet now properly populate PAX reports

**Status:** ✅ Ship name extraction fully corrected - all report types now capture authentic dropdown selections

## External Dependencies

- **Database**: @neondatabase/serverless, drizzle-orm
- **UI Components**: @radix-ui/* components, lucide-react icons, shadcn/ui
- **File Processing**: multer, xlsx, exceljs, react-dropzone
- **Template Engine**: handlebars
- **State Management**: @tanstack/react-query
- **Styling**: tailwindcss, class-variance-authority
- **Spreadsheet Editor**: handsontable
- **Dropbox API**: For file upload and storage
```