# Excel Data Processing Application

## Overview
This is a full-stack web application designed for uploading, processing, and exporting Excel files, coupled with template-based document generation. The system aims to streamline document creation, enhance data management, and provide robust reporting capabilities for businesses. Key capabilities include data preview, template selection, and export. The project envisions future ship-specific data management.

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

### System Design Choices
- **Ship-Agnostic to Ship-Specific Workflow**: Designed for eventual implementation of ship-specific data management, requiring database schema modifications (`ship_id`), file system changes (ship-specific subdirectories), and API endpoint modifications for complete data and template isolation per ship.
- **Version Control**: Tracks all saved dispatch sheet edits.
- **Modular Processors**: Uses dedicated processors for distinct data extraction and processing tasks (e.g., `cellExtractor`, `simpleEODProcessor`, `PAXProcessor`).
- **Data Isolation**: Ensures complete separation of templates and data per ship, preventing cross-contamination.
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