import { useState, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useSidebar } from "@/contexts/sidebar-context";
import { HotTable } from "@handsontable/react";
import { registerAllModules } from "handsontable/registry";
import { Upload, FileSpreadsheet, Edit3, Save, Download } from "lucide-react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import "handsontable/dist/handsontable.full.min.css";
import { SidebarNavigation, MobileNavigation } from "@/components/sidebar-navigation";

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
  const [file, setFile] = useState<SpreadsheetFile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState<SpreadsheetData>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
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
            
            for (let r = 0; r < totalRowsWithExtra; r++) {
              const row = allRows[r] || [];
              const completeRow: (string | number)[] = [];
              
              for (let c = 0; c < actualColumnCount; c++) {
                completeRow[c] = row[c] !== undefined ? row[c] : '';
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
    
    setEditedData([...file.data]);
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

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Fixed Desktop Sidebar */}
      <div className="hidden md:block fixed left-0 top-0 h-full z-10">
        <SidebarNavigation />
      </div>

      {/* Mobile Navigation */}
      <MobileNavigation />
      
      <div className={`flex-1 transition-all duration-300 ${
        isCollapsed ? "ml-16" : "ml-64"
      }`}>
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-lg">
            <h1 className="text-2xl font-bold mb-2">Spreadsheet View</h1>
            <p className="text-blue-100">Upload, edit, and download Excel spreadsheets directly in your browser</p>
          </div>

          {/* Upload Section */}
          {!file && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="w-5 h-5" />
                  Upload Excel File
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  {...getRootProps()}
                  className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                    isDragActive
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-300 hover:border-gray-400"
                  }`}
                >
                  <input {...getInputProps()} />
                  <FileSpreadsheet className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  {isDragActive ? (
                    <p className="text-blue-600">Drop your Excel file here...</p>
                  ) : (
                    <div>
                      <p className="text-gray-600 mb-4">
                        Drag and drop an Excel file here, or click below to browse
                      </p>
                      <Button size="lg" className="mb-4 flex items-center gap-2 mx-auto bg-blue-600 hover:bg-blue-700 text-white">
                        <Upload className="w-5 h-5" />
                        Choose Excel File
                      </Button>
                      <p className="text-sm text-gray-500">
                        Supports .xlsx and .xls files • Maximum 10MB
                      </p>
                    </div>
                  )}
                </div>
                
                {isUploading && (
                  <div className="mt-4">
                    <Progress value={uploadProgress} className="w-full" />
                    <p className="text-sm text-gray-600 mt-2">
                      Processing file... {uploadProgress}%
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* File Info and Actions */}
          {file && !isEditing && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-green-600" />
                  File Ready
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="bg-green-50 p-4 rounded-lg">
                    <h3 className="font-semibold text-green-800 mb-2">{file.name}</h3>
                    <p className="text-green-700 text-sm">
                      {file.data.length} rows × {file.headers.length} columns
                    </p>
                  </div>
                  
                  <div className="flex gap-3">
                    <Button onClick={handleEditSpreadsheet} className="flex items-center gap-2">
                      <Edit3 className="w-4 h-4" />
                      Edit Spreadsheet
                    </Button>
                    
                    <Button onClick={handleDownload} variant="outline" className="flex items-center gap-2">
                      <Download className="w-4 h-4" />
                      Download Original
                    </Button>
                    
                    <Button onClick={() => setFile(null)} variant="outline">
                      Upload New File
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Editor Section */}
          {isEditing && file && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-blue-600" />
                  Editing: {file.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Save Button */}
                  <div className="flex gap-3">
                    <Button onClick={handleSaveChanges} className="flex items-center gap-2">
                      <Save className="w-4 h-4" />
                      Save Changes
                    </Button>
                    
                    <Button onClick={() => setIsEditing(false)} variant="outline">
                      Cancel
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
                        contextMenu={true}
                        manualRowResize={true}
                        manualColumnResize={true}
                        stretchH="none"
                        width="100%"
                        height="500"
                        licenseKey="non-commercial-and-evaluation"
                        afterChange={handleDataChange}
                        className="htCenter"
                        colWidths={120}
                        autoColumnSize={false}
                        preventOverflow="horizontal"
                        fillHandle={true}
                        mergeCells={false}
                        outsideClickDeselects={false}
                        allowEmpty={true}
                        trimWhitespace={false}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Download Section */}
          {file && !isEditing && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="w-5 h-5 text-purple-600" />
                  Download Options
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Button onClick={handleDownload} className="w-full justify-start">
                    <Download className="w-4 h-4 mr-2" />
                    Download Edited Spreadsheet
                  </Button>
                  <p className="text-sm text-gray-600">
                    Downloads the spreadsheet with all your changes applied
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}