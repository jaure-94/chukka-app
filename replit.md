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