# Excel Data Processing Application

## Overview

This is a full-stack web application for uploading, processing, and exporting Excel files with template-based document generation. The system allows users to upload Excel files, preview the data, select processing templates, and export results to Dropbox.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript
- **Styling**: Tailwind CSS with shadcn/ui component library
- **State Management**: TanStack Query for server state management
- **Routing**: Wouter for client-side routing
- **Build Tool**: Vite for development and production builds

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **File Upload**: Multer middleware for handling multipart/form-data
- **Excel Processing**: xlsx library for parsing Excel files
- **Template Engine**: Handlebars for document generation

### Database Layer
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Database**: PostgreSQL (configured for Neon serverless)
- **Schema**: Three main tables for file management and processing tracking

## Key Components

### File Upload System
- Drag-and-drop interface using react-dropzone
- File validation for Excel formats (.xlsx, .xls)
- 10MB file size limit
- Multer-based server-side processing

### Data Processing Pipeline
1. **File Upload**: Stores uploaded files with metadata
2. **Excel Parsing**: Extracts data from all sheets using xlsx library
3. **Database Storage**: Stores parsed data with sheet and row organization
4. **Template Processing**: Applies Handlebars templates to generate documents
5. **Export**: Uploads results to Dropbox using REST API

### Template System
- Handlebars-based template engine
- Built-in helpers for currency formatting, date formatting, and calculations
- Support for multiple template types (employee reports, summary reports, custom)
- Template files stored in server/templates directory

### External Integrations
- **Dropbox API**: File upload and storage using OAuth access tokens
- **Neon Database**: Serverless PostgreSQL with connection pooling

## Data Flow

1. User uploads Excel file via drag-and-drop interface
2. Server validates file type and size, stores to filesystem
3. Excel parser extracts data from all sheets
4. Parsed data stored in database with file association
5. User selects template type for processing
6. Template processor generates documents using parsed data
7. Results optionally exported to Dropbox
8. Processing history maintained for user reference

## External Dependencies

### Production Dependencies
- **Database**: @neondatabase/serverless, drizzle-orm
- **UI Components**: @radix-ui/* components, lucide-react icons
- **File Processing**: multer, xlsx
- **Template Engine**: handlebars
- **State Management**: @tanstack/react-query
- **Styling**: tailwindcss, class-variance-authority

### Development Dependencies
- **Build Tools**: vite, esbuild
- **TypeScript**: Full TypeScript setup with strict mode
- **Database Tools**: drizzle-kit for migrations

## Deployment Strategy

### Development
- Vite dev server with HMR for frontend
- tsx for TypeScript execution in development
- Concurrent frontend/backend development setup

### Production
- Vite builds frontend to dist/public
- esbuild bundles server code to dist/index.js
- Single deployment artifact with static file serving
- Environment variables for database and Dropbox configuration

### Database Management
- Drizzle migrations in migrations/ directory
- Schema defined in shared/schema.ts
- Push-based deployment with `npm run db:push`

## Changelog
- June 28, 2025: Initial setup with Excel processing pipeline
- June 28, 2025: Updated progress bar steps to better reflect user workflow (Document Upload → Data Preview → Template Selection → Report Generation → Export)
- June 28, 2025: Fixed "Replace Document" functionality to properly reset both file and data preview states
- June 29, 2025: Aligned processing status section with progress bar workflow
- June 29, 2025: Updated file upload heading to "Upload Dispatch Excel File"
- June 30, 2025: Implemented dual file upload system with separate fields for dispatch and EOD template files
- June 30, 2025: Updated EOD upload heading to "Upload EOD Report Excel Template File"
- June 30, 2025: Removed data preview for EOD template file (only dispatch file shows preview)
- June 30, 2025: Implemented EOD template processing functionality with dispatch data mapping
  - Created EODProcessor service to extract tour_name, num_adult, num_chd from dispatch files
  - Added support for {{tour_name}}, {{num_adult}}, {{num_chd}} placeholders in EOD templates
  - Updated processing pipeline to handle both dispatch and EOD template files together
  - Added "EOD Template Processing" option to template selector
- June 30, 2025: Removed template selection step to streamline workflow
  - Workflow now: Document Upload → Data Preview → Report Generation → Export
  - Automatically uses EOD template processing when both files are uploaded
  - Uses customer participation template for single dispatch file processing
- June 30, 2025: Moved "Generate Report" button above processing status for better user flow
- June 30, 2025: Verified EOD template processing functionality working correctly
  - Successfully extracts dispatch data: tour names, adult counts (261), child counts (86)
  - Properly replaces {{num_adult}} and {{num_chd}} delimiters in Excel template cells
  - Generated Excel files contain populated dispatch information instead of placeholders
- June 30, 2025: Moved "Report Generated" section to appear directly below generate button for better UX flow
- June 30, 2025: Restructured EOD template processing to create individual tour rows instead of combining all tours into single cells
  - Modified EODTemplateData interface to support array of tours with individual tour data
  - Updated data extraction logic to create separate TourData entries for each unique tour
  - Rewrote template processing to insert each tour on its own row with corresponding adult/child counts
  - Maintained total calculations in cells D24 and E24 as requested

## User Preferences

Preferred communication style: Simple, everyday language.