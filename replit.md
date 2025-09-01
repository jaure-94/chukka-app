# Excel Data Processing Application

## Overview
This is a full-stack web application designed for uploading, processing, and exporting Excel files, coupled with template-based document generation. The system aims to streamline document creation, enhance data management, and provide robust reporting capabilities for maritime operations. Key capabilities include data preview, template selection, export, and complete multi-ship data management with Ship A, Ship B, and Ship C support.

## Recent Changes (September 2025)
- **✅ GMAIL SMTP EMAIL DELIVERY FULLY OPERATIONAL**: Successfully implemented direct Gmail SMTP authentication for reliable email delivery
  - **Production Success**: Gmail SMTP sending maritime reports directly to recipient inboxes with first-attempt success
  - **Authentication Complete**: Gmail App Password integration working seamlessly with professional sender formatting
  - **Real Email Delivery**: Maritime reports delivered directly from tawandajaujau@gmail.com to any recipient
  - **Professional Templates**: Maritime-branded emails with Excel attachments delivered reliably
- **Phase 1 Document Sharing Backend Infrastructure**: Completed comprehensive backend implementation for maritime report sharing via email and Dropbox integration
  - **EmailService**: Created professional email service with SendGrid integration, HTML templates, rate limiting, SMTP fallback, and maritime-specific templates
  - **Enhanced DropboxService**: Upgraded with batch upload capability, ship/date folder organization, shared link generation with expiration dates, and metadata tracking
  - **SharingController**: Built comprehensive sharing orchestration layer with activity tracking, error handling, template management, and service testing
  - **Database Schema**: Added sharing_activities and share_templates tables with complete audit trail and metadata support
  - **API Routes**: Implemented secure sharing endpoints with authentication, validation, and role-based access control
- **Component-Driven Development**: Maintained reusable architecture principles throughout sharing implementation
- **Updated Role System**: Revised user roles from 5-tier to 4-tier system per client requirements: superuser, admin, dispatcher, and general user, with updated permissions mapping and database schema
- **Ship-Specific Template Upload System**: Fixed critical bug where Ship B/C templates were incorrectly saved to Ship A's directory
- **Complete Ship Isolation**: Implemented full ship-specific architecture with dedicated directories, database isolation, and parameter-based routing
- **JWT Authentication System**: Implemented secure authentication with bcrypt password hashing, HTTP-only cookies, and JWT tokens
- **Application-Wide Scroll Fix**: Applied consistent scroll behavior pattern across all major pages using h-screen overflow-hidden with single overflow-y-auto scroll context

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
- **Schema**: Supports file management, processing tracking, user management, and ship-specific data partitioning
- **Authentication**: Users table with secure password hashing, role-based permissions, and JWT token management

### Core Features
- **File Upload System**: Drag-and-drop with validation.
- **Data Processing Pipeline**: File storage, Excel parsing, database storage, template application, export.
- **Template System**: Supports dynamic data insertion, complex formatting preservation (merged cells, colors, borders, fonts, text wrapping), and calculations.
- **Report Generation**: Automatic dual report (dispatch and EOD/PAX) generation with downloadable files and processing history. Supports both generating new reports from templates and appending new records to existing reports (successive reports).
- **User Management**: Comprehensive user management with details, status, and actions.
- **Authentication & Authorization**: JWT-based authentication with role-based access control, secure password management, and HTTP-only cookie sessions.
- **Role-Based Security**: Four user roles (superuser, admin, dispatcher, general) with granular permissions for different system operations.
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