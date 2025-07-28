import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { History, File, Eye, Download, Plus, FileText, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { SidebarNavigation, MobileNavigation } from "@/components/sidebar-navigation";
import { useSidebar } from "@/contexts/sidebar-context";
import { HotTable } from "@handsontable/react";
import type { HotTableClass } from "@handsontable/react";
import { registerAllModules } from "handsontable/registry";
import "handsontable/dist/handsontable.full.min.css";
import * as XLSX from "xlsx";

// Register Handsontable modules
registerAllModules();

type SpreadsheetData = (string | number)[][];

interface SpreadsheetFile {
  name: string;
  data: SpreadsheetData;
  headers: string[];
}

export default function CreateDispatch() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isCollapsed } = useSidebar();
  const hotTableRef = useRef<HotTableClass>(null);

  const [file, setFile] = useState<SpreadsheetFile | null>(null);
  const [editedData, setEditedData] = useState<SpreadsheetData>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [showAllVersions, setShowAllVersions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [savedFileId, setSavedFileId] = useState<string | null>(null);
  const [showUpdateEOD, setShowUpdateEOD] = useState(false);
  const [currentScrollColumn, setCurrentScrollColumn] = useState(0);

  // Fetch dispatch template
  const { data: dispatchTemplate, isLoading: isLoadingDispatch } = useQuery({
    queryKey: ["/api/dispatch-templates"],
  }) as { data: any; isLoading: boolean };

  // Fetch dispatch versions
  const { data: dispatchVersions = [], isLoading: isLoadingVersions } = useQuery({
    queryKey: ["/api/dispatch-versions"],
  }) as { data: any[]; isLoading: boolean };

  // Fetch output files for successive dispatch
  const { data: outputFiles = [], isLoading: isLoadingOutputFiles } = useQuery({
    queryKey: ["/api/output-files"],
  }) as { data: any[]; isLoading: boolean };

  // Load dispatch template when available
  useEffect(() => {
    if (dispatchTemplate && !file) {
      loadDispatchTemplate();
    }
  }, [dispatchTemplate, file]);

  const loadDispatchTemplate = async () => {
    if (!dispatchTemplate?.filePath) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`/api/files/${dispatchTemplate.filename}`);
      if (!response.ok) throw new Error('Failed to fetch template');
      
      const arrayBuffer = await response.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);
      
      // Convert to binary string for XLSX
      const binaryString = data.reduce((acc, byte) => acc + String.fromCharCode(byte), '');
      
      // Parse Excel file
      const workbook = XLSX.read(binaryString, { type: "binary" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Get the complete data range
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
      const actualColumnCount = range.e.c + 1;
      const actualRowCount = range.e.r + 1;
      
      // Convert to JSON
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
        header: 1, 
        range: worksheet['!ref'],
        defval: '',
        blankrows: true
      });
      
      // Helper function to convert Excel time decimal to readable format
      const convertExcelTimeToReadable = (value: any) => {
        if (typeof value === 'number' && value > 0 && value < 1) {
          const totalMinutes = Math.round(value * 24 * 60);
          const hours = Math.floor(totalMinutes / 60);
          const minutes = totalMinutes % 60;
          
          const period = hours >= 12 ? 'PM' : 'AM';
          const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
          const displayMinutes = minutes.toString().padStart(2, '0');
          
          return `${displayHours}:${displayMinutes} ${period}`;
        }
        return value;
      };

      if (jsonData.length > 0) {
        const allRows = jsonData as SpreadsheetData;
        const extraRows = 10;
        const totalRowsWithExtra = actualRowCount + extraRows;
        const completeRows: SpreadsheetData = [];
        
        for (let r = 0; r < totalRowsWithExtra; r++) {
          const row = allRows[r] || [];
          const completeRow: (string | number)[] = [];
          
          for (let c = 0; c < actualColumnCount; c++) {
            let cellValue = row[c] !== undefined ? row[c] : '';
            
            // Convert time values in column B
            if (c === 1) {
              cellValue = convertExcelTimeToReadable(cellValue);
            }
            
            completeRow[c] = cellValue;
          }
          
          completeRows.push(completeRow);
        }
        
        // Generate headers
        const genericHeaders = Array.from({length: actualColumnCount}, (_, i) => {
          if (i < 26) {
            return String.fromCharCode(65 + i);
          } else {
            const firstLetter = String.fromCharCode(65 + Math.floor(i / 26) - 1);
            const secondLetter = String.fromCharCode(65 + (i % 26));
            return firstLetter + secondLetter;
          }
        });
        
        setFile({
          name: dispatchTemplate.originalFilename,
          data: completeRows,
          headers: genericHeaders
        });
      }
    } catch (error) {
      console.error('Error loading dispatch template:', error);
      toast({
        title: "Error",
        description: "Failed to load dispatch template",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditSpreadsheet = async () => {
    // If file is not loaded yet, load the dispatch template first
    if (!file && dispatchTemplate) {
      await loadDispatchTemplate();
    }
    
    if (!file) {
      toast({
        title: "Error",
        description: "No dispatch template available to edit",
        variant: "destructive",
      });
      return;
    }
    
    setEditedData([...file.data]);
    setIsEditing(true);
    setHasUnsavedChanges(false);
  };

  const handleDataChange = (changes: any) => {
    if (changes) {
      setHasUnsavedChanges(true);
    }
  };

  const handleSave = async () => {
    if (!editedData.length) return;
    
    setIsLoading(true);
    try {
      // Debug: Log the data being saved
      console.log('Saving edited data with', editedData.length, 'rows');
      if (editedData.length > 8) {
        console.log('Sample data row 8:', editedData[7]); // Row 8 (index 7)
        console.log('Sample data row 13:', editedData[12]); // Row 13 (index 12)
      }
      
      // Create workbook and worksheet
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.aoa_to_sheet(editedData);
      XLSX.utils.book_append_sheet(workbook, worksheet, "Template");
      
      // Convert to buffer
      const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
      
      // Create FormData
      const formData = new FormData();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      formData.append('file', blob, `edited_dispatch_${Date.now()}.xlsx`);
      
      // Save the file with formatting preservation
      const response = await fetch('/api/save-dispatch-sheet', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) throw new Error('Failed to save file');
      
      const result = await response.json();
      
      toast({
        title: "Success",
        description: "Dispatch sheet saved with formatting preserved!",
      });
      
      setHasUnsavedChanges(false);
      setSavedFileId(result.file.id);
      
      // Close the editing view and show Update EOD button
      setIsEditing(false);
      setShowUpdateEOD(true);
      
      // Update the file data
      if (file) {
        setFile({
          ...file,
          data: editedData
        });
      }
      
      return result;
    } catch (error) {
      console.error('Error saving dispatch sheet:', error);
      toast({
        title: "Error",
        description: "Failed to save dispatch sheet",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditedData([]);
    setHasUnsavedChanges(false);
  };

  // Update EOD Report mutation
  const updateEODMutation = useMutation({
    mutationFn: async () => {
      if (!savedFileId) {
        throw new Error('No saved file ID available');
      }

      const response = await apiRequest("POST", "/api/process-eod-from-dispatch", {
        dispatchFileId: savedFileId
      });

      return response.json();
    },
    onSuccess: (result) => {
      toast({
        title: "Success! 🎉",
        description: `EOD report generated successfully! Files: ${result.eodFile} & ${result.dispatchFile}`,
      });
      
      // Invalidate all related caches
      queryClient.invalidateQueries({ queryKey: ["/api/generated-reports"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dispatch-versions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/output-files"] });
      
      // Redirect to Reports page after a short delay
      setTimeout(() => {
        setLocation("/reports");
      }, 2000);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update EOD report",
        variant: "destructive",
      });
      console.error("Error updating EOD report:", error);
    },
  });

  const handleUpdateEOD = () => {
    updateEODMutation.mutate();
  };

  // Successive dispatch entry mutation
  const successiveDispatchMutation = useMutation({
    mutationFn: async (existingEodFilename: string) => {
      if (!savedFileId) {
        throw new Error('No saved file ID available');
      }

      const response = await apiRequest("POST", "/api/add-successive-dispatch", {
        dispatchFileId: savedFileId,
        existingEodFilename: existingEodFilename
      });

      return response.json();
    },
    onSuccess: (result) => {
      toast({
        title: "Success! 🎉",
        description: `Successive dispatch entry added! New EOD file: ${result.eodFile}`,
      });
      
      // Invalidate all related caches
      queryClient.invalidateQueries({ queryKey: ["/api/generated-reports"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dispatch-versions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/output-files"] });
      
      // Redirect to Reports page after a short delay
      setTimeout(() => {
        setLocation("/reports");
      }, 2000);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to add successive dispatch entry",
        variant: "destructive",
      });
      console.error("Error adding successive dispatch entry:", error);
    },
  });

  // Debug mutation to test data extraction
  const debugDataMutation = useMutation({
    mutationFn: async () => {
      if (!savedFileId) {
        throw new Error('No saved file ID available');
      }

      const response = await apiRequest("POST", "/api/debug-dispatch-data", {
        dispatchFileId: savedFileId
      });

      return response.json();
    },
    onSuccess: (result) => {
      console.log("Debug Data Result:", result);
      toast({
        title: "Debug Complete",
        description: `Found ${result.extractedTours.tours.length} tours. Check console for details.`,
      });
    },
    onError: (error) => {
      console.error("Debug error:", error);
      toast({
        title: "Debug Error",
        description: "Failed to debug dispatch data",
        variant: "destructive",
      });
    },
  });

  const handleDebugData = () => {
    debugDataMutation.mutate();
  };

  // Horizontal scrolling functions
  const getColumnsToScroll = () => {
    // Check if screen is smaller (mobile/tablet)
    const screenWidth = window.innerWidth;
    return screenWidth < 1024 ? 4 : 7; // 4 columns for smaller screens, 7 for larger
  };

  const handleScrollLeft = () => {
    if (!hotTableRef.current?.hotInstance) return;
    
    const columnsToScroll = getColumnsToScroll();
    const newScrollColumn = Math.max(0, currentScrollColumn - columnsToScroll);
    
    const hot = hotTableRef.current.hotInstance;
    
    try {
      // Method 1: Select a cell to force scrolling
      hot.selectCell(0, newScrollColumn);
      
      // Method 2: Scroll to show the selected column
      hot.scrollViewportTo(0, newScrollColumn);
      
      // Method 3: Force render refresh
      hot.render();
      
      console.log(`Scrolled left to column ${newScrollColumn}, total columns: ${getTotalColumns()}`);
    } catch (error) {
      console.error('Error scrolling left:', error);
    }
    
    setCurrentScrollColumn(newScrollColumn);
  };

  const handleScrollRight = () => {
    if (!hotTableRef.current?.hotInstance || !file) return;
    
    const columnsToScroll = getColumnsToScroll();
    const totalColumns = file.headers.length || editedData[0]?.length || 0;
    const newScrollColumn = Math.min(totalColumns - 1, currentScrollColumn + columnsToScroll);
    
    const hot = hotTableRef.current.hotInstance;
    
    try {
      // Method 1: Select a cell to force scrolling
      hot.selectCell(0, newScrollColumn);
      
      // Method 2: Scroll to show the selected column
      hot.scrollViewportTo(0, newScrollColumn);
      
      // Method 3: Force render refresh
      hot.render();
      
      console.log(`Scrolled right to column ${newScrollColumn}, total columns: ${getTotalColumns()}`);
    } catch (error) {
      console.error('Error scrolling right:', error);
    }
    
    setCurrentScrollColumn(newScrollColumn);
  };

  const getTotalColumns = () => {
    if (file?.headers.length) return file.headers.length;
    if (editedData[0]?.length) return editedData[0].length;
    return 0;
  };

  const canScrollLeft = currentScrollColumn > 0;
  const canScrollRight = currentScrollColumn < Math.max(0, getTotalColumns() - getColumnsToScroll());

  // Handle viewing dispatch version
  const handleViewVersion = async (version: any) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/files/${version.filename}`);
      if (!response.ok) throw new Error('Failed to fetch version file');
      
      const arrayBuffer = await response.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      
      const worksheetData: SpreadsheetData = [];
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:Z100');
      
      for (let row = range.s.r; row <= Math.min(range.e.r, 99); row++) {
        const rowData: any[] = [];
        for (let col = range.s.c; col <= Math.min(range.e.c, 25); col++) {
          const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
          const cell = worksheet[cellAddress];
          let cellValue = cell ? cell.v : '';
          
          if (cell && cell.t === 'n' && cellValue > 0 && cellValue < 1) {
            const hours = Math.floor(cellValue * 24);
            const minutes = Math.floor((cellValue * 24 - hours) * 60);
            cellValue = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
          }
          
          rowData[col] = cellValue;
        }
        worksheetData[row] = rowData;
      }
      
      setFile({
        name: version.originalFilename,
        data: worksheetData,
        headers: []
      });
      setEditedData(worksheetData);
      setIsEditing(true);
      setShowUpdateEOD(false);
      
    } catch (error) {
      console.error('Error loading version:', error);
      toast({
        title: "Error",
        description: "Failed to load dispatch version",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle downloading dispatch version
  const handleDownloadVersion = (version: any) => {
    const link = document.createElement('a');
    link.href = `/api/files/${version.filename}`;
    link.download = version.originalFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <SidebarNavigation />
      <MobileNavigation />
      
      <div 
        className={`transition-all duration-300 ${
          isCollapsed ? 'ml-16' : 'ml-64'
        } p-6`}
      >
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Create New Dispatch Record</h1>
            <p className="text-gray-600">Edit the dispatch template spreadsheet to create a new record</p>
          </div>

          {isLoadingDispatch ? (
            <Card>
              <CardContent className="flex items-center justify-center py-8">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Loading dispatch template...</p>
                </div>
              </CardContent>
            </Card>
          ) : !dispatchTemplate ? (
            <Card>
              <CardContent className="text-center py-8">
                <p className="text-gray-600 mb-4">No dispatch template found. Please upload a template first.</p>
                <Button onClick={() => setLocation("/templates/edit")}>
                  Upload Template
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Template Information */}
              <Card>
                <CardContent className="py-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Dispatch Template</h3>
                      <p className="text-sm text-gray-600">{dispatchTemplate.originalFilename}</p>
                    </div>
                    <div className="flex space-x-3">
                      {!isEditing && !showUpdateEOD ? (
                        <Button 
                          onClick={handleEditSpreadsheet}
                          disabled={isLoading}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          Edit Dispatch Sheet
                        </Button>
                      ) : isEditing ? (
                        <div className="flex space-x-2">
                          <Button 
                            onClick={handleSave}
                            disabled={isLoading}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            {isLoading ? 'Saving...' : 'Save Changes'}
                          </Button>
                          <Button 
                            onClick={handleCancel}
                            variant="outline"
                            disabled={isLoading}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : showUpdateEOD ? (
                        <div className="flex space-x-2">
                          <Button 
                            onClick={handleUpdateEOD}
                            disabled={updateEODMutation.isPending}
                            className="bg-purple-600 hover:bg-purple-700"
                          >
                            {updateEODMutation.isPending ? 'Updating...' : 'Update EOD Report'}
                          </Button>
                          <Button 
                            onClick={handleDebugData}
                            disabled={debugDataMutation.isPending}
                            variant="outline"
                            className="bg-orange-50 hover:bg-orange-100 border-orange-300"
                          >
                            {debugDataMutation.isPending ? 'Debugging...' : 'Debug Data'}
                          </Button>
                          <Button 
                            onClick={() => {
                              setShowUpdateEOD(false);
                              setSavedFileId(null);
                            }}
                            variant="outline"
                          >
                            Edit Again
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  
                  {hasUnsavedChanges && (
                    <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-sm text-amber-800">⚠️ You have unsaved changes</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* PAX Template Card - Only show when file is saved */}
              {showUpdateEOD && savedFileId && (
                <Card>
                  <CardContent className="py-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">PAX Template</h3>
                        <p className="text-sm text-gray-600">Generate PAX reports from dispatch data</p>
                      </div>
                      <div className="flex space-x-3">
                        <Button 
                          onClick={() => {
                            // TODO: Implement PAX report functionality
                            console.log('PAX Report functionality will be implemented later');
                          }}
                          disabled={false}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          Update PAX Report
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Spreadsheet Editor */}
              {isEditing && file && (
                <Card>
                  <CardContent className="py-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">Edit Dispatch Sheet</h3>
                      
                      {/* Horizontal Scroll Controls */}
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-600 mr-2">
                          Scroll by {getColumnsToScroll()} columns:
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleScrollLeft}
                          disabled={!canScrollLeft}
                          className="flex items-center space-x-1"
                        >
                          <ChevronLeft className="h-4 w-4" />
                          <span className="hidden sm:inline">Left</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleScrollRight}
                          disabled={!canScrollRight}
                          className="flex items-center space-x-1"
                        >
                          <span className="hidden sm:inline">Right</span>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    
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
                          height="600"
                          licenseKey="non-commercial-and-evaluation"
                          afterChange={handleDataChange}
                          className="htCenter"
                          colWidths={function(index) {
                            if (index === 0) return 360;
                            return 120;
                          }}
                          autoColumnSize={false}
                          preventOverflow="horizontal"
                          fillHandle={true}
                          mergeCells={false}
                          outsideClickDeselects={false}
                          allowEmpty={true}
                          trimWhitespace={false}
                          minRows={editedData.length}
                          maxRows={editedData.length + 20}
                          viewportRowRenderingOffset={50}
                          viewportColumnRenderingOffset={10}
                          cells={function(row, col) {
                            const cellProperties: any = {};
                            let classNames = [];
                            
                            if (col === 0) {
                              classNames.push('htLeft');
                            }
                            
                            if (row >= 0 && row <= 5) {
                              classNames.push('bold-cell');
                            }
                            
                            if (col === 1) {
                              classNames.push('red-font');
                            }
                            
                            if (row === 5) {
                              classNames.push('bottom-center-cell');
                              classNames.push('thick-bottom-border');
                            }
                            
                            if (row === 0) {
                              classNames.push('ship-info-cell');
                            }
                            
                            // Add dropdown for Ship Name cell (B1 = row 0, col 1)
                            if (row === 0 && col === 1) {
                              cellProperties.type = 'dropdown';
                              cellProperties.source = [
                                'MARDI GRAS',
                                'ESCAPE',
                                'ENCHANTED PRINCESS', 
                                'SUNSHINE',
                                'LIBERTY OTS',
                                'CELEBRATION',
                                'VISTA',
                                'AQUA',
                                'WORLD AMERICA',
                                'ISLAND PRINCESS',
                                'SYMPHONY OTS'
                              ];
                              cellProperties.strict = false; // Allow custom values
                              cellProperties.allowInvalid = true; // Allow typing custom values
                            }
                            
                            cellProperties.className = classNames.join(' ');
                            return cellProperties;
                          }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Successive Dispatch Entry */}
              {showUpdateEOD && savedFileId && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Plus className="h-5 w-5" />
                      Add to Existing EOD Report
                    </CardTitle>
                    <p className="text-sm text-gray-600">
                      Add this dispatch entry to an existing EOD report instead of creating a new one
                    </p>
                  </CardHeader>
                  <CardContent>
                    {isLoadingOutputFiles ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Latest EOD Report - Featured */}
                        {outputFiles
                          .filter((file: any) => file.filename.startsWith('eod_'))
                          .slice(0, 1)
                          .map((file: any) => {
                            const isAlreadyUsed = file.filename.includes(savedFileId);
                            
                            return (
                              <div
                                key={file.filename}
                                className={`p-6 border-2 rounded-lg transition-all ${
                                  isAlreadyUsed 
                                    ? 'border-gray-300 bg-gray-50' 
                                    : 'border-blue-300 bg-gradient-to-r from-blue-50 to-indigo-50 hover:border-blue-400'
                                }`}
                              >
                                <div className="flex items-center justify-between mb-4">
                                  <div className="flex items-center space-x-3">
                                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                                      <FileText className="h-6 w-6 text-blue-600" />
                                    </div>
                                    <div>
                                      <h3 className="font-semibold text-gray-900">Latest EOD Report</h3>
                                      <p className="text-sm text-gray-600">{file.filename}</p>
                                    </div>
                                  </div>
                                  {isAlreadyUsed && (
                                    <Badge variant="secondary" className="text-xs">
                                      Already Used
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-sm text-gray-600 mb-4">
                                  Modified: {new Date(file.lastModified).toLocaleDateString()} at{" "}
                                  {new Date(file.lastModified).toLocaleTimeString()}
                                </div>
                                <Button
                                  onClick={() => successiveDispatchMutation.mutate(file.filename)}
                                  disabled={successiveDispatchMutation.isPending || isAlreadyUsed}
                                  size="lg"
                                  className={`w-full ${
                                    isAlreadyUsed 
                                      ? 'bg-gray-400 cursor-not-allowed' 
                                      : 'bg-blue-600 hover:bg-blue-700 text-white font-medium'
                                  }`}
                                >
                                  {successiveDispatchMutation.isPending ? (
                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                                  ) : (
                                    <Plus className="w-5 h-5 mr-2" />
                                  )}
                                  {isAlreadyUsed ? 'Entry Already Added' : 'Add This Entry to Latest Report'}
                                </Button>
                              </div>
                            );
                          })}
                        
                        {/* Other EOD Reports - Collapsed */}
                        {outputFiles.filter((file: any) => file.filename.startsWith('eod_')).length > 1 && (
                          <div className="border-t pt-4">
                            <h4 className="font-medium text-gray-900 mb-3">Other EOD Reports</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {outputFiles
                                .filter((file: any) => file.filename.startsWith('eod_'))
                                .slice(1, 5)
                                .map((file: any) => {
                                  const isAlreadyUsed = file.filename.includes(savedFileId);
                                  
                                  return (
                                    <div key={file.filename} className="flex items-center justify-between p-3 border rounded-lg hover:border-blue-300 transition-colors">
                                      <div className="flex items-center space-x-3">
                                        <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                                          <FileText className="w-4 h-4 text-green-600" />
                                        </div>
                                        <div>
                                          <h4 className="font-medium text-gray-900 text-sm">
                                            {file.filename}
                                          </h4>
                                          <p className="text-xs text-gray-500">
                                            {new Date(file.lastModified).toLocaleDateString()} at {new Date(file.lastModified).toLocaleTimeString()}
                                          </p>
                                        </div>
                                      </div>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => successiveDispatchMutation.mutate(file.filename)}
                                        disabled={successiveDispatchMutation.isPending || isAlreadyUsed}
                                      >
                                        {successiveDispatchMutation.isPending ? (
                                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-1"></div>
                                        ) : (
                                          <Plus className="w-4 h-4 mr-1" />
                                        )}
                                        {isAlreadyUsed ? 'Already Added' : 'Add Entry'}
                                      </Button>
                                    </div>
                                  );
                                })}
                            </div>
                          </div>
                        )}
                        
                        {outputFiles.filter((file: any) => file.filename.startsWith('eod_')).length === 0 && (
                          <div className="text-center py-8 text-gray-500">
                            <FileText className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                            <p>No existing EOD reports found</p>
                            <p className="text-sm">Create your first EOD report to use successive dispatch entries</p>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Version History */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <History className="h-5 w-5" />
                    Dispatch Sheet Versions
                  </CardTitle>
                  <p className="text-sm text-gray-600">
                    View and manage previously saved dispatch sheet versions
                  </p>
                </CardHeader>
                <CardContent>
                  {isLoadingVersions ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                  ) : dispatchVersions.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <File className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                      <p>No saved versions yet</p>
                      <p className="text-sm">Save an edited dispatch sheet to see versions here</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {dispatchVersions.slice(0, showAllVersions ? dispatchVersions.length : 3).map((version: any) => (
                        <div key={version.id} className="flex items-center justify-between p-4 border rounded-lg hover:border-blue-300 transition-colors">
                          <div className="flex items-center space-x-4">
                            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                              <File className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                              <h4 className="font-medium text-gray-900">
                                {version.originalFilename}
                              </h4>
                              <p className="text-sm text-gray-500">
                                Version {version.id} • Saved on {new Date(version.createdAt).toLocaleDateString()} at{" "}
                                {new Date(version.createdAt).toLocaleTimeString()}
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            <Badge variant="secondary" className="text-xs">
                              Saved
                            </Badge>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewVersion(version)}
                              disabled={isLoading}
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              View
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDownloadVersion(version)}
                            >
                              <Download className="w-4 h-4 mr-1" />
                              Download
                            </Button>
                          </div>
                        </div>
                      ))}
                      
                      {dispatchVersions.length > 3 && (
                        <div className="text-center pt-3 border-t">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowAllVersions(!showAllVersions)}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            {showAllVersions 
                              ? 'Show Less' 
                              : `View More Versions (${dispatchVersions.length - 3} more)`
                            }
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>


            </div>
          )}
        </div>
      </div>
    </div>
  );
}