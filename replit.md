# Excel Data Processing Application

## Overview
This is a full-stack web application designed for uploading, processing, and exporting Excel files, coupled with template-based document generation. The system aims to streamline document creation, enhance data management, and provide robust reporting capabilities for maritime operations. Key capabilities include data preview, template selection, export, and complete multi-ship data management with Ship A, Ship B, and Ship C support.

## Recent Changes (August 2025)
- **Ship-Specific Template Upload System**: Fixed critical bug where Ship B/C templates were incorrectly saved to Ship A's directory
- **Frontend Template Logic**: Corrected API endpoints and FormData handling for proper ship-aware uploads
- **Database Path Alignment**: Resolved file path mismatches between database records and actual file storage locations
- **Complete Ship Isolation**: Implemented full ship-specific architecture with dedicated directories, database isolation, and parameter-based routing

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
### Frontend
- **Framework**: React with TypeScript
- **Styling**: Tailwind CSS with shadcn/ui
- **State Management**: TanStack Query
- **Routing**: Wouter
- **Build Tool**: Vite
- **UI/UX Decisions**: Modern gradient headers, 4-step workflow visualization, interactive upload progress, celebration sections, color-coded sections, professional layouts, responsive sidebar navigation, professional user and template management interfaces, spreadsheet view with in-browser editing.

### Backend
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **File Upload**: Multer
- **Excel Processing**: ExcelJS (for formatting preservation), xlsx (for initial parsing)
- **Template Engine**: Handlebars for general templates, custom ExcelJS-based processing for EOD reports.

### Database
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Database**: PostgreSQL (configured for Neon serverless)
- **Schema**: Supports file management, processing tracking, user management, and ship-specific data partitioning.

### Core Features
- **File Upload System**: Drag-and-drop with validation.
- **Data Processing Pipeline**: File storage, Excel parsing, database storage, template application, export.
- **Template System**: Supports dynamic data insertion, complex formatting preservation (merged cells, colors, borders, fonts, text wrapping), and calculations.
- **Report Generation**: Automatic dual report (dispatch and EOD/PAX) generation with downloadable files and processing history. Supports both generating new reports from templates and appending new records to existing reports (successive reports).
- **User Management**: Comprehensive user management with details, status, and actions.
- **Spreadsheet View**: In-browser Excel editing capabilities (upload, edit, save, download).
- **Auto-Calculations**: Real-time calculations for relevant fields.
- **Responsive Design**: Global sidebar navigation and responsive layouts.
- **Data Preservation**: Ensures original template header data (e.g., ship name, date) is correctly extracted and preserved.
- **Date Formatting**: Consistent DD/MM/YYYY date formatting in reports.
- **Ship-Specific Downloads**: Complete ship-aware file download system with proper path routing.
- **Successive Record Management**: Both PAX and EOD reports support adding successive records that update existing files in-place rather than creating new ones, with complete ship-aware functionality.

### System Design Choices
- **Ship-Specific Architecture**: Fully implemented ship-specific data management with complete isolation:
  - Database schema with `ship_id` fields across all template tables
  - Ship-specific file system structure (`uploads/ship-a/`, `uploads/ship-b/`, `uploads/ship-c/`)
  - Dedicated API endpoints with ship-aware routing and parameter-based navigation
  - Complete template and data isolation per ship, preventing cross-contamination
- **Template Upload System**: Fixed frontend/backend integration ensuring proper FormData uploads with ship-specific directory storage
- **Version Control**: Tracks all saved dispatch sheet edits.
- **Modular Processors**: Uses dedicated processors for distinct data extraction and processing tasks (e.g., `cellExtractor`, `simpleEODProcessor`, `PAXProcessor`).
- **Successive Report Logic**: Critical distinction maintained between generating a new report and appending to an existing one, strictly enforced per ship.

## External Dependencies
- **Database**: @neondatabase/serverless, drizzle-orm
- **UI Components**: @radix-ui/* components, lucide-react icons, shadcn/ui
- **File Processing**: multer, xlsx, exceljs, react-dropzone
- **Template Engine**: handlebars
- **State Management**: @tanstack/react-query
- **Styling**: tailwindcss, class-variance-authority
- **Spreadsheet Editor**: handsontable
- **Cloud Storage**: Dropbox API