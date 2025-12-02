import { useState, useRef, useMemo, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useSidebar } from "@/contexts/sidebar-context";
import { useIsMobile } from "@/hooks/use-mobile";
import { HotTable } from "@handsontable/react";
import { registerAllModules } from "handsontable/registry";
import { Upload, FileSpreadsheet, Edit3, Save, Download, X, Maximize, Minimize } from "lucide-react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import "handsontable/dist/handsontable.full.min.css";
import { SidebarNavigation, MobileNavigation } from "@/components/sidebar-navigation";
import { Breadcrumbs } from "@/components/breadcrumbs";

// Register Handsontable modules
registerAllModules();

type SpreadsheetData = (string | number)[][];

interface SpreadsheetFile {
  name: string;
  data: SpreadsheetData;
  headers: string[];
}

export default function SpreadsheetView() {
  const { toast } = useToast();
  const { isCollapsed } = useSidebar();
  const isMobile = useIsMobile();
  const [file, setFile] = useState<SpreadsheetFile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState<SpreadsheetData>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [spreadsheetViewMode, setSpreadsheetViewMode] = useState<'mobile' | 'landscape'>('mobile');
  const hotTableRef = useRef(null);

  const onDrop = async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    const uploadedFile = acceptedFiles[0];
    
    if (!uploadedFile.name.match(/\.(xlsx|xls)$/i)) {
      toast({
        title: "Invalid file type",
        description: "Please upload an Excel file (.xlsx or .xls)",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 100);

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: "binary" });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          
          // Get the complete data range from the worksheet
          const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
          const actualColumnCount = range.e.c + 1; // +1 because it's 0-indexed
          const actualRowCount = range.e.r + 1; // +1 because it's 0-indexed
          
          // Debug worksheet information
          console.log('Worksheet analysis:', {
            worksheetRef: worksheet['!ref'],
            range: range,
            startRow: range.s.r,
            endRow: range.e.r,
            startCol: range.s.c,
            endCol: range.e.c,
            calculatedRows: actualRowCount,
            calculatedCols: actualColumnCount,
            // Check for specific cells
            cellA23: worksheet['A23'],
            cellB23: worksheet['B23'],
            cellA24: worksheet['A24'],
            cellA25: worksheet['A25'],
            cellA30: worksheet['A30'],
            // Get all cell addresses
            allCellAddresses: Object.keys(worksheet).filter(key => key.match(/^[A-Z]+[0-9]+$/)).sort()
          });
          
          // Convert to JSON ensuring we capture the complete range
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
            header: 1, 
            range: worksheet['!ref'], // Use the full range
            defval: '', // Use empty string for missing cells
            blankrows: true // Include blank rows
          });
          
          if (jsonData.length > 0) {
            const allRows = jsonData as SpreadsheetData;
            
            // Ensure we have exactly the right number of rows and columns, plus extra rows
            const extraRows = 10; // Add 10 extra rows for editing
            const totalRowsWithExtra = actualRowCount + extraRows;
            const completeRows: SpreadsheetData = [];
            
            // Helper function to convert Excel time decimal to readable format
            const convertExcelTimeToReadable = (value: any) => {
              if (typeof value === 'number' && value > 0 && value < 1) {
                // This is likely a time value (fraction of a day)
                const totalMinutes = Math.round(value * 24 * 60);
                const hours = Math.floor(totalMinutes / 60);
                const minutes = totalMinutes % 60;
                
                // Format as 12-hour time with AM/PM
                const period = hours >= 12 ? 'PM' : 'AM';
                const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
                const displayMinutes = minutes.toString().padStart(2, '0');
                
                return `${displayHours}:${displayMinutes} ${period}`;
              }
              return value;
            };

            for (let r = 0; r < totalRowsWithExtra; r++) {
              const row = allRows[r] || [];
              const completeRow: (string | number)[] = [];
              
              for (let c = 0; c < actualColumnCount; c++) {
                let cellValue = row[c] !== undefined ? row[c] : '';
                
                // Convert time values in column B (index 1) - "TOUR TIME + duration" column
                if (c === 1) {
                  cellValue = convertExcelTimeToReadable(cellValue);
                }
                
                completeRow[c] = cellValue;
              }
              
              completeRows.push(completeRow);
            }
            
            // Generate generic column headers (A, B, C, etc.)
            const genericHeaders = Array.from({length: actualColumnCount}, (_, i) => {
              if (i < 26) {
                return String.fromCharCode(65 + i); // A, B, C, D, etc.
              } else {
                // For columns beyond Z, use AA, AB, AC, etc.
                const firstLetter = String.fromCharCode(65 + Math.floor(i / 26) - 1);
                const secondLetter = String.fromCharCode(65 + (i % 26));
                return firstLetter + secondLetter;
              }
            });
            
            setFile({
              name: uploadedFile.name,
              data: completeRows,
              headers: genericHeaders,
            });
            
            setUploadProgress(100);
            toast({
              title: "File uploaded successfully",
              description: `${uploadedFile.name} loaded with ${actualRowCount} rows and ${actualColumnCount} columns (${extraRows} extra rows added).`,
            });
            
            // Debug log for development - check specific rows
            console.log('Excel parsing results:', {
              originalRows: actualRowCount,
              totalRowsWithExtra: totalRowsWithExtra,
              totalColumns: actualColumnCount,
              worksheetRange: worksheet['!ref'],
              firstRowLength: completeRows[0]?.length,
              extraRowsAdded: extraRows,
              headers: genericHeaders,
              // Check specific rows 23-30 (0-indexed would be 22-29)
              row23: completeRows[22],
              row24: completeRows[23],
              row25: completeRows[24],
              row26: completeRows[25],
              row27: completeRows[26],
              row28: completeRows[27],
              row29: completeRows[28],
              row30: completeRows[29],
              // Check if these rows have any content
              rowsWithContent: completeRows.map((row, index) => ({
                rowNumber: index + 1,
                hasContent: row.some(cell => cell !== undefined && cell !== null && cell !== ''),
                cellCount: row.length,
                content: row.filter(cell => cell !== undefined && cell !== null && cell !== '')
              })).filter(r => r.hasContent)
            });
          }
        } catch (error) {
          toast({
            title: "Error reading file",
            description: "Failed to parse the Excel file. Please try again.",
            variant: "destructive",
          });
        } finally {
          setIsUploading(false);
          setTimeout(() => setUploadProgress(0), 1000);
        }
      };
      
      reader.readAsBinaryString(uploadedFile);
    } catch (error) {
      setIsUploading(false);
      setUploadProgress(0);
      toast({
        title: "Upload failed",
        description: "Failed to upload the file. Please try again.",
        variant: "destructive",
      });
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
    maxFiles: 1,
    multiple: false,
  });

  const handleEditSpreadsheet = () => {
    if (!file) return;
    
    const dataToEdit = [...file.data];
    console.log('Starting edit mode with data:', {
      totalRows: dataToEdit.length,
      totalCols: dataToEdit[0]?.length,
      row23Data: dataToEdit[22],
      row24Data: dataToEdit[23],
      row30Data: dataToEdit[29],
      lastRowWithContent: dataToEdit.findLastIndex(row => row.some(cell => cell !== '')),
      allRowsWithContent: dataToEdit.map((row, idx) => ({
        rowNum: idx + 1,
        hasContent: row.some(cell => cell !== ''),
        cells: row.filter(cell => cell !== '')
      })).filter(r => r.hasContent)
    });
    
    setEditedData(dataToEdit);
    setIsEditing(true);
  };

  const handleSaveChanges = () => {
    if (!file || !editedData) return;

    // Update the file data with edited data
    setFile(prev => prev ? { ...prev, data: editedData } : null);
    setIsEditing(false);
    
    toast({
      title: "Changes saved",
      description: "Your spreadsheet changes have been saved successfully.",
    });
  };

  const handleDownload = () => {
    if (!file) return;

    try {
      // Create a new workbook
      const wb = XLSX.utils.book_new();
      
      // Use the data directly (headers are already included as first row)
      const ws = XLSX.utils.aoa_to_sheet(file.data);
      
      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
      
      // Generate Excel file
      const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      
      // Download the file
      const fileName = file.name.replace(/\.(xlsx|xls)$/i, '_edited.xlsx');
      saveAs(blob, fileName);
      
      toast({
        title: "Download started",
        description: `${fileName} is being downloaded.`,
      });
    } catch (error) {
      toast({
        title: "Download failed",
        description: "Failed to generate the Excel file. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDataChange = (changes: any) => {
    if (!changes) return;
    
    const newData = [...editedData];
    changes.forEach(([row, col, oldValue, newValue]: [number, number, any, any]) => {
      if (newData[row]) {
        newData[row][col] = newValue;
      }
    });
    setEditedData(newData);
  };

  const getColumnsToDisplay = useMemo(() => {
    if (!isMobile || spreadsheetViewMode === 'landscape') {
      return null; // Show all columns
    }
    // Mobile portrait view: Show first 8 columns
    return [0, 1, 2, 3, 4, 5, 6, 7];
  }, [isMobile, spreadsheetViewMode]);

  const getColWidths = useCallback((index: number) => {
    if (isMobile) {
      if (spreadsheetViewMode === 'mobile') {
        if (index === 0) return 150;
        return 80;
      } else {
        if (index === 0) return 200;
        return 100;
      }
    }
    if (index === 0) return 360;
    return 120;
  }, [isMobile, spreadsheetViewMode]);

  const getHandsontableHeight = useMemo(() => {
    if (isMobile) {
      return spreadsheetViewMode === 'mobile' ? 400 : 500;
    }
    return 600;
  }, [isMobile, spreadsheetViewMode]);

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Fixed Desktop Sidebar */}
      <div className="hidden md:block fixed left-0 top-0 h-full z-10">
        <SidebarNavigation />
      </div>

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col transition-all duration-300 ${
        isCollapsed ? 'md:ml-16' : 'md:ml-64'
      }`}>
        {/* Mobile Header with Navigation */}
        <header className="bg-white border-b border-gray-200 md:hidden sticky top-0 z-20">
          <div className="px-3 sm:px-4 py-2 sm:py-3">
            <div className="flex items-center gap-3">
              <MobileNavigation />
              <div className="flex-1 min-w-0">
                <h1 className="text-base sm:text-lg font-bold text-gray-900 truncate">
                  Spreadsheet View
                </h1>
                <p className="text-xs sm:text-sm text-gray-500 truncate">
                  Upload & edit Excel files
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Breadcrumbs - Mobile Optimized */}
        <Breadcrumbs />

        <div className="flex-1 overflow-y-auto">
        {/* Header - Desktop Only */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white hidden md:block p-4 sm:p-6 rounded-lg mx-4 sm:mx-6 mt-4 sm:mt-6">
          <h1 className="text-xl sm:text-2xl font-bold mb-2">Spreadsheet View</h1>
          <p className="text-sm sm:text-base text-blue-100">Upload, edit, and download Excel spreadsheets directly in your browser</p>
        </div>

        <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-5 md:space-y-6">

          {/* Upload Section */}
          {!file && (
            <Card className="touch-manipulation">
              <CardHeader className="px-3 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <Upload className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                  <span>Upload Excel File</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 sm:px-6 pb-4 sm:pb-6">
                <div
                  {...getRootProps()}
                  className={`border-2 border-dashed rounded-lg p-4 sm:p-6 md:p-8 text-center cursor-pointer transition-colors touch-manipulation ${
                    isDragActive
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-300 hover:border-gray-400 active:bg-gray-50"
                  }`}
                >
                  <input {...getInputProps()} />
                  <FileSpreadsheet className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 text-gray-400" />
                  {isDragActive ? (
                    <p className="text-sm sm:text-base text-blue-600">Drop your Excel file here...</p>
                  ) : (
                    <div>
                      <p className="text-xs sm:text-sm md:text-base text-gray-600 mb-3 sm:mb-4 px-2">
                        Drag and drop an Excel file here, or click below to browse
                      </p>
                      <Button 
                        size="lg" 
                        className="mb-3 sm:mb-4 flex items-center gap-2 mx-auto bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white h-11 sm:h-12 text-sm sm:text-base touch-manipulation"
                      >
                        <Upload className="w-4 h-4 sm:w-5 sm:h-5" />
                        Choose Excel File
                      </Button>
                      <p className="text-xs sm:text-sm text-gray-500 px-2">
                        Supports .xlsx and .xls files • Maximum 10MB
                      </p>
                    </div>
                  )}
                </div>
                
                {isUploading && (
                  <div className="mt-3 sm:mt-4">
                    <Progress value={uploadProgress} className="w-full" />
                    <p className="text-xs sm:text-sm text-gray-600 mt-2">
                      Processing file... {uploadProgress}%
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* File Info and Actions */}
          {file && !isEditing && (
            <Card className="touch-manipulation">
              <CardHeader className="px-3 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <FileSpreadsheet className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 flex-shrink-0" />
                  <span>File Ready</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 sm:px-6 pb-4 sm:pb-6">
                <div className="space-y-3 sm:space-y-4">
                  <div className="bg-green-50 p-3 sm:p-4 rounded-lg">
                    <h3 className="font-semibold text-green-800 mb-1.5 sm:mb-2 text-sm sm:text-base break-words">{file.name}</h3>
                    <p className="text-green-700 text-xs sm:text-sm">
                      {file.data.length} rows × {file.headers.length} columns
                    </p>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                    <Button 
                      onClick={handleEditSpreadsheet} 
                      className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white h-10 sm:h-11 text-sm sm:text-base touch-manipulation flex-1 sm:flex-none"
                    >
                      <Edit3 className="w-4 h-4 flex-shrink-0" />
                      <span>Edit Spreadsheet</span>
                    </Button>
                    
                    <Button 
                      onClick={handleDownload} 
                      variant="outline" 
                      className="flex items-center gap-2 border-gray-300 hover:bg-gray-50 active:bg-gray-100 h-10 sm:h-11 text-sm sm:text-base touch-manipulation flex-1 sm:flex-none"
                    >
                      <Download className="w-4 h-4 flex-shrink-0" />
                      <span className="hidden sm:inline">Download Original</span>
                      <span className="sm:hidden">Download</span>
                    </Button>
                    
                    <Button 
                      onClick={() => setFile(null)} 
                      variant="outline"
                      className="border-gray-300 hover:bg-gray-50 active:bg-gray-100 h-10 sm:h-11 text-sm sm:text-base touch-manipulation flex-1 sm:flex-none"
                    >
                      <Upload className="w-4 h-4 mr-2 flex-shrink-0" />
                      <span className="hidden sm:inline">Upload New File</span>
                      <span className="sm:hidden">New File</span>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Editor Section */}
          {isEditing && file && (
            <Card className="touch-manipulation">
              <CardHeader className="px-3 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                  <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                    <Edit3 className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 flex-shrink-0" />
                    <span className="truncate">Editing: {file.name}</span>
                  </CardTitle>

                  {/* Spreadsheet View Mode Toggle */}
                  {isMobile && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSpreadsheetViewMode(prev => prev === 'mobile' ? 'landscape' : 'mobile')}
                      className="flex items-center space-x-1 px-2 sm:px-3 h-9 sm:h-10 text-xs sm:text-sm touch-manipulation w-full sm:w-auto"
                    >
                      {spreadsheetViewMode === 'mobile' ? (
                        <>
                          <Maximize className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                          <span>View Full Spreadsheet</span>
                        </>
                      ) : (
                        <>
                          <Minimize className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                          <span>Return to Mobile View</span>
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="px-3 sm:px-4 md:px-6 pb-4 sm:pb-6">
                <div className="space-y-3 sm:space-y-4">
                  {/* Save Button */}
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                    <Button 
                      onClick={handleSaveChanges} 
                      className="flex items-center gap-2 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white h-10 sm:h-11 text-sm sm:text-base touch-manipulation flex-1 sm:flex-none"
                    >
                      <Save className="w-4 h-4 flex-shrink-0" />
                      <span>Save Changes</span>
                    </Button>
                    
                    <Button 
                      onClick={() => setIsEditing(false)} 
                      variant="outline"
                      className="border-gray-300 hover:bg-gray-50 active:bg-gray-100 h-10 sm:h-11 text-sm sm:text-base touch-manipulation flex-1 sm:flex-none"
                    >
                      <X className="w-4 h-4 mr-2 flex-shrink-0" />
                      <span>Cancel</span>
                    </Button>
                  </div>
                  
                  {/* Handsontable Editor */}
                  <div className="border rounded-lg overflow-auto w-full max-w-full">
                    <div className="min-w-full">
                      <HotTable
                        ref={hotTableRef}
                        data={editedData}
                        colHeaders={file.headers}
                        rowHeaders={true}
                        contextMenu={!isMobile}
                        manualRowResize={!isMobile}
                        manualColumnResize={!isMobile}
                        stretchH="none"
                        width="100%"
                        height={getHandsontableHeight}
                        licenseKey="non-commercial-and-evaluation"
                        afterChange={handleDataChange}
                        className="htCenter"
                        colWidths={getColWidths}
                        autoColumnSize={false}
                        preventOverflow="horizontal"
                        fillHandle={!isMobile}
                        mergeCells={false}
                        outsideClickDeselects={false}
                        allowEmpty={true}
                        trimWhitespace={false}
                        minRows={editedData.length}
                        maxRows={editedData.length + 20}
                        viewportRowRenderingOffset={isMobile ? 10 : 50}
                        viewportColumnRenderingOffset={isMobile ? 3 : 10}
                        renderAllRows={false}
                        renderAllColumns={false}
                        cells={function(row, col) {
                          const cellProperties: any = {};
                          let classNames = [];
                          
                          // Filter columns for mobile view
                          if (isMobile && spreadsheetViewMode === 'mobile' && getColumnsToDisplay() && !getColumnsToDisplay()?.includes(col)) {
                            cellProperties.readOnly = true;
                            cellProperties.width = 0;
                            cellProperties.renderer = function(instance: any, td: HTMLTableCellElement, row: number, col: number, prop: string | number, value: any, cellProperties: Handsontable.CellProperties) {
                              td.style.display = 'none';
                            };
                            return cellProperties;
                          }
                          
                          // Left-justify everything in column A
                          if (col === 0) {
                            classNames.push('htLeft');
                          }
                          
                          // Bold content from row 1 to row 6 (0-indexed: 0-5)
                          if (row >= 0 && row <= 5) {
                            classNames.push('bold-cell');
                          }
                          
                          // Make everything under column B font red (column index 1)
                          if (col === 1) {
                            classNames.push('red-font');
                          }
                          
                          // Bottom-align and center all contents in row 6 (0-indexed: 5)
                          if (row === 5) {
                            classNames.push('bottom-center-cell');
                          }
                          
                          // Add thick black border under row 6 (0-indexed: 5)
                          if (row === 5) {
                            classNames.push('thick-bottom-border');
                          }
                          
                          // Add thin black border under row 1 (0-indexed: 0)
                          if (row === 0) {
                            classNames.push('thin-bottom-border');
                          }
                          
                          // Make contents in column A with "Tour" bold
                          if (col === 0 && editedData[row] && editedData[row][0] && 
                              typeof editedData[row][0] === 'string' && 
                              editedData[row][0].includes('Tour')) {
                            classNames.push('bold-cell');
                          }

                          if (isMobile) {
                            classNames.push('htMobileCell');
                            if (spreadsheetViewMode === 'landscape') {
                              classNames.push('htLandscapeCell');
                            }
                          }
                          
                          cellProperties.className = classNames.join(' ');
                          return cellProperties;
                        }}
                        afterRenderer={(TD, row, col, prop, value, cellProperties) => {
                          if (isMobile) {
                            TD.style.minHeight = '44px';
                            TD.style.lineHeight = 'normal';
                            TD.style.fontSize = '11px';
                            if (row < 10) {
                              TD.style.fontSize = '10px';
                            }
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Download Section */}
          {file && !isEditing && (
            <Card className="touch-manipulation">
              <CardHeader className="px-3 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <Download className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600 flex-shrink-0" />
                  <span>Download Options</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 sm:px-6 pb-4 sm:pb-6">
                <div className="space-y-2 sm:space-y-3">
                  <Button 
                    onClick={handleDownload} 
                    className="w-full justify-start bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white h-10 sm:h-11 text-sm sm:text-base touch-manipulation"
                  >
                    <Download className="w-4 h-4 mr-2 flex-shrink-0" />
                    <span>Download Edited Spreadsheet</span>
                  </Button>
                  <p className="text-xs sm:text-sm text-gray-600">
                    Downloads the spreadsheet with all your changes applied
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
        </div>
      </div>

      <style>{`
        /* Mobile specific Handsontable styling */
        .htMobileCell {
          min-height: 44px !important;
          line-height: normal !important;
          font-size: 11px !important;
          padding: 4px 6px !important;
          touch-action: manipulation;
        }

        .htMobileCell.current {
          background-color: #e0f2fe !important;
        }

        .htLandscapeCell {
          font-size: 12px !important;
          padding: 6px 8px !important;
        }

        .handsontable th {
          min-height: 44px !important;
          font-size: 10px !important;
          padding: 4px 6px !important;
          line-height: normal !important;
        }
      `}</style>
    </div>
  );
}