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
- June 30, 2025: Enhanced EOD processor to preserve all Excel formatting properties
  - Implemented deep copying of cell properties including background colors, borders, bold fonts, and checkboxes
  - Added preservation of merged cells with automatic duplication for each tour section
  - Maintained row height and column width formatting across duplicated template sections
  - Ensured complete formatting integrity from template to generated output file
- June 30, 2025: Successfully implemented xlsx-populate library for complete Excel formatting preservation
  - Replaced XLSX library with xlsx-populate specifically designed for formatting preservation
  - Enhanced template copying system to maintain exact formatting from rows 17-25 for each tour section
  - Eliminated "undefined" value entries and improved placeholder replacement logic
  - Confirmed formatting preservation working correctly with colors, borders, fonts, and structure maintained
- June 30, 2025: Updated processing history display to show only 3 results initially with expandable "View More" option
- June 30, 2025: Removed template selection step from Processing Status section to match streamlined 4-step workflow
- June 30, 2025: Created enhanced EOD processor with improved formatting preservation
  - Implemented complete row-by-row copying approach for Excel formatting
  - Enhanced cell style preservation using direct xlsx-populate operations
  - Added comprehensive template section duplication with all visual properties intact
- June 30, 2025: Switched to ExcelJS library for reliable Excel formatting preservation
  - Replaced xlsx-populate with ExcelJS due to style copying failures
  - Implemented comprehensive formatting storage and replication system
  - Added deep copying of font, fill, border, alignment, and number format properties
  - Enhanced template section duplication with complete visual formatting integrity
- July 1, 2025: Implemented advanced merged cell functionality for tour sections
  - Added merged cells for tour names across columns B through I with center alignment
  - Created merged cells for comments/notes subheadings across columns B through I with bold formatting
  - Implemented merged cells for {{notes}} delimiter across columns B through I with left alignment
  - Successfully tested merged cell generation and formatting preservation
- July 1, 2025: Enhanced formatting and alignment improvements
  - Changed Comments/Notes subheading alignment from center to left
  - Implemented strike-through removal from rows 3-24 to clean up document formatting
  - Added strike-through filtering in template formatting storage to prevent replication
  - Enhanced visual consistency across all generated tour sections
- July 1, 2025: Implemented notes data extraction and text wrapping functionality
  - Added notes field to TourData interface for dispatch data extraction
  - Created extractNotes method to find Notes/Comments/Remarks columns in dispatch files
  - Enhanced data extraction to combine notes from multiple rows for same tour
  - Implemented {{notes}} placeholder replacement with actual notes content from dispatch data
  - Added text wrapping (wrapText: true) and dynamic row height calculation for notes cells
  - Enhanced notes display with left-aligned, top-vertical positioning for optimal readability
  - Applied dark blue text color (FF003366) and removed bold formatting for notes content
- July 2, 2025: Enhanced cell formatting cleanup for specific template cells
  - Applied comprehensive formatting cleanup to cells E3-E6, F10, D18-D19, E18-E19, D23-D24, E23-E24, I22-I24
  - Removed strikethrough, italic, and bold formatting from designated cells
  - Applied consistent dark blue text color (FF003366) to all specified cells
  - Maintained original font size while ensuring clean visual presentation
- July 2, 2025: Updated dispatch sheet processing to start from row 8 with specific column headers
  - Modified Excel parser to ignore first 7 rows and read headers from row 8
  - Implemented exact column header mapping: Tour Name, Departure, Return, Adults, Children, Comp, Total Guests, Notes
  - Updated EOD processor and dispatch generator to prioritize new column names
  - Enhanced data preview to show properly structured dispatch data starting from row 8
  - Maintained backward compatibility with legacy column names for existing templates
- July 2, 2025: Implemented dispatch sheet filtering for data preview
  - Added intelligent sheet detection to identify "Grand Turk" and other dispatch sheets
  - Modified Excel parser to only process and display dispatch-relevant sheets in data preview
  - Enhanced sheet filtering logic to detect dispatch headers (Tour Name, Adults, Children, etc.)
  - Removed irrelevant template and summary sheets from data preview interface
- July 2, 2025: Enhanced template upload page with welcoming design and clear workflow explanation
  - Added modern gradient header with 4-step workflow visualization (Upload → Create → Update → Download Multiple Reports)
  - Implemented interactive upload progress indicators with real-time status feedback
  - Created celebration section with green gradient styling when both files are ready
  - Enhanced visual hierarchy with better spacing, color-coded sections, and professional layout
- July 2, 2025: Redesigned date picker system with separated date and time selection
  - Created TourDatePicker component with dropdown selectors for year, month, and day
  - Implemented TimePicker component with "Select Time" label for individual time selection
  - Added shared Tour Date that applies to both departure and return times
  - Enhanced styling with rounded borders, color-coded sections, and better spacing
- July 2, 2025: Implemented auto-calculation for Total Guests field
  - Added real-time calculation that sums Adults + Children + Comp Guests automatically
  - Created visual indicators including "Auto-calculated" badge and calculation breakdown
  - Disabled manual input with read-only styling to prevent calculation errors
- July 2, 2025: Created comprehensive Users page with professional design
  - Added 10 dummy users with realistic data (names, roles, departments, contact info)
  - Implemented user cards with avatar initials, status badges, and contact details
  - Added stats overview cards showing active, pending, inactive, and total user counts
  - Integrated dropdown menus for user management actions (view, edit, reset password, deactivate)
  - Styled with proper spacing, icons, and responsive grid layout
  - Redesigned user display from cards to table format with rows and columns for better data organization
  - Added comprehensive table layout with avatar, user info, role, department, contact details, status, and actions
- July 2, 2025: Implemented responsive sidebar navigation with content shifting
  - Added global sidebar context to manage collapse/expand state across all pages
  - Content automatically shifts left/right based on sidebar state (16px collapsed, 64px expanded)
  - Applied responsive layout to all pages: Users, Templates, Reports, Create Dispatch
  - Added smooth 300ms transitions for all layout changes
- July 2, 2025: Redesigned Dashboard tab as "Home" with welcome page
  - Changed navigation from "Dashboard" to "Home" linking to root URL (/)
  - Updated template-upload page to include sidebar navigation and responsive layout
  - Enhanced welcome header with modern gradient design and 4-step workflow visualization
  - Integrated sidebar navigation with proper content shifting for mobile and desktop
- July 2, 2025: Created Edit Templates page with document replacement functionality
  - Added new route /templates/edit with full template management interface
  - Implemented sidebar navigation and breadcrumb navigation for nested routes (Templates > Edit Templates)
  - Created document upload areas with "Replace Document" buttons for both dispatch and EOD templates
  - Added current template display with download functionality and metadata (filename, upload date)
  - Implemented "Save and Replace Templates" functionality with proper file upload and database storage
  - Enhanced navigation with ChevronRight breadcrumb separators and hover effects
  - Fixed "Replace Document" buttons to properly trigger file explorer using label-input connection
  - Added automatic redirection back to Templates page after successful template replacement with 1.5 second delay
- July 2, 2025: Implemented comprehensive dispatch record system with automatic dual report generation
  - Modified dispatch record creation to automatically generate both dispatch and EOD reports using all active records
  - Fixed Reports page to display generated reports with separate download buttons for dispatch and EOD files
  - Updated report statistics to show total reports and total records processed
  - Streamlined form submission to eliminate duplicate report generation
  - Enhanced report display with proper labeling (Single Record Report vs Batch Report based on record count)
  - Both dispatch and EOD reports are now automatically created whenever a new dispatch record is added
  - Reports page shows downloadable files immediately after record creation with proper cache invalidation

## User Preferences

Preferred communication style: Simple, everyday language.