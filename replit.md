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