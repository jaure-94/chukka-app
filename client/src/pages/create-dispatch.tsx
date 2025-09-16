import { useState, useEffect, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { History, File, Eye, Download, Plus, FileText, ChevronLeft, ChevronRight, Users, CheckCircle, Edit, Save, X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { SidebarNavigation, MobileNavigation } from "@/components/sidebar-navigation";
import { ShipSelector } from "@/components/ship-selector";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { useSidebar } from "@/contexts/sidebar-context";
import { useShipContext } from "@/contexts/ship-context";
import { useDispatchSession } from "@/contexts/dispatch-session-context";
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
  const [location, setLocation] = useLocation();
  const params = useParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isCollapsed } = useSidebar();
  const { currentShip, setCurrentShip, getShipDisplayName, getSelectedShipName } = useShipContext();
  const { currentSession, createSession, updateSession, getActiveSession, hasActiveSession } = useDispatchSession();
  const hotTableRef = useRef<HotTableClass>(null);
  
  // Extract ship and session from URL params (/create-dispatch/ship-a/session-id)
  const shipFromUrl = params.ship as string;
  const sessionFromUrl = params.sessionId as string;
  const shipToUse = (shipFromUrl || currentShip || 'ship-a') as 'ship-a' | 'ship-b' | 'ship-c';
  
  // Update ship context when URL changes
  useEffect(() => {
    if (shipFromUrl && ['ship-a', 'ship-b', 'ship-c'].includes(shipFromUrl)) {
      setCurrentShip(shipFromUrl as 'ship-a' | 'ship-b' | 'ship-c');
    }
  }, [shipFromUrl, setCurrentShip]);

  const [file, setFile] = useState<SpreadsheetFile | null>(null);
  const [editedData, setEditedData] = useState<SpreadsheetData>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [showAllVersions, setShowAllVersions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [savedFileId, setSavedFileId] = useState<string | null>(null);
  const [showUpdateEOD, setShowUpdateEOD] = useState(false);
  const [currentScrollColumn, setCurrentScrollColumn] = useState(0);
  const [showPaxSuccessModal, setShowPaxSuccessModal] = useState(false);
  const [paxFileName, setPaxFileName] = useState<string>('');
  const [showUpdatePaxSuccessModal, setShowUpdatePaxSuccessModal] = useState(false);
  const [updatePaxFileName, setUpdatePaxFileName] = useState<string>('');
  const [showEodSuccessModal, setShowEodSuccessModal] = useState(false);
  const [eodFileName, setEodFileName] = useState<string>('');
  const [sessionInitialized, setSessionInitialized] = useState(false);

  useEffect(() => {
    const initializeSession = async () => {
      if (!shipToUse || sessionInitialized) return;

      try {
        if (sessionFromUrl) {
          if (!currentSession || currentSession.id !== sessionFromUrl) {
            console.log('Session from URL not matching current session');
          }
        } else {
          const activeSession = await getActiveSession(shipToUse);
          if (activeSession) {
            setLocation(`/create-dispatch/${shipToUse}/${activeSession.id}`);
            return;
          }
        }
        setSessionInitialized(true);
      } catch (error) {
        console.error('Error initializing session:', error);
        setSessionInitialized(true);
      }
    };

    initializeSession();
  }, [shipToUse, sessionFromUrl, currentSession, getActiveSession, setLocation, sessionInitialized]);

  // Fetch dispatch template for current ship
  const { data: dispatchTemplate, isLoading: isLoadingDispatch } = useQuery({
    queryKey: ["/api/dispatch-templates", shipToUse],
    queryFn: () => fetch(`/api/dispatch-templates?ship=${shipToUse}`).then(res => res.json()),
    enabled: !!shipToUse
  }) as { data: any; isLoading: boolean };

  // Fetch dispatch versions for current ship
  const { data: dispatchVersions = [], isLoading: isLoadingVersions } = useQuery({
    queryKey: ["/api/dispatch-versions", shipToUse],
    queryFn: () => fetch(`/api/dispatch-versions?ship=${shipToUse}`).then(res => res.json()),
    enabled: !!shipToUse
  }) as { data: any[]; isLoading: boolean };

  // Fetch output files for current ship
  const { data: outputFiles = [], isLoading: isLoadingOutputFiles } = useQuery({
    queryKey: ["/api/output-files", shipToUse],
    queryFn: () => fetch(`/api/output-files?ship=${shipToUse}`).then(res => res.json()),
    enabled: !!shipToUse
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
            
            // Set correct values for B1 and B2 cells
            if (r === 0 && c === 1) {
              // B1 should be "CCL" (no dropdown)
              cellValue = 'CCL';
            } else if (r === 1 && c === 1) {
              // B2 should use selected ship name from context
              cellValue = getSelectedShipName(shipToUse);
            } else if (c === 1) {
              // Convert time values in column B for other rows
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
      // Log data being saved for transparency
      console.log('Saving edited data with', editedData.length, 'rows');
      
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
      
      // Save the file with formatting preservation (ship-aware)
      formData.append('shipId', shipToUse);
      formData.append('selectedShipName', getSelectedShipName(shipToUse));
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
      
      // Update session with saved dispatch version
      if (currentSession) {
        try {
          await updateSession(currentSession.id, {
            dispatchVersionId: result.file.id,
            spreadsheetSnapshot: editedData,
            status: 'active'
          });
        } catch (error) {
          console.error('Failed to update session:', error);
        }
      } else if (sessionInitialized) {
        // Create new session if none exists
        try {
          const newSession = await createSession(shipToUse, {
            dispatchVersionId: result.file.id,
            spreadsheetSnapshot: editedData,
          });
          setLocation(`/create-dispatch/${shipToUse}/${newSession.id}`);
        } catch (error) {
          console.error('Failed to create session:', error);
        }
      }
      
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
        dispatchFileId: savedFileId,
        shipId: shipToUse
      });

      return response.json();
    },
    onSuccess: async (result) => {
      setEodFileName(result.eodFile);
      setShowEodSuccessModal(true);
      
      // Update session with EOD filename
      if (currentSession) {
        try {
          await updateSession(currentSession.id, {
            eodFilename: result.eodFile,
          });
        } catch (error) {
          console.error('Failed to update session with EOD filename:', error);
        }
      }
      
      // Invalidate all related caches for current ship
      queryClient.invalidateQueries({ queryKey: ["/api/generated-reports", currentShip] });
      queryClient.invalidateQueries({ queryKey: ["/api/dispatch-versions", currentShip] });
      queryClient.invalidateQueries({ queryKey: ["/api/output-files", currentShip] });
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
        existingEodFilename: existingEodFilename,
        shipId: currentShip
      });

      return response.json();
    },
    onSuccess: (result) => {
      setEodFileName(result.eodFile);
      setShowEodSuccessModal(true);
      
      // Invalidate all related caches for current ship
      queryClient.invalidateQueries({ queryKey: ["/api/generated-reports", currentShip] });
      queryClient.invalidateQueries({ queryKey: ["/api/dispatch-versions", currentShip] });
      queryClient.invalidateQueries({ queryKey: ["/api/output-files", currentShip] });
      
      // Also refresh consolidated PAX reports since successive dispatch triggers consolidated PAX
      queryClient.invalidateQueries({ queryKey: ["/api/consolidated-pax-reports"] });
      queryClient.invalidateQueries({ queryKey: ["/api/consolidated-pax-reports/latest"] });
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

  // PAX update mutation
  const updatePaxMutation = useMutation({
    mutationFn: async () => {
      if (!savedFileId) {
        throw new Error('No saved file ID available');
      }

      const response = await apiRequest("POST", "/api/generate-pax-report", {
        dispatchFileId: savedFileId,
        shipId: currentShip
      });

      return response.json();
    },
    onSuccess: async (result) => {
      setPaxFileName(result.paxFile);
      setShowPaxSuccessModal(true);
      
      // Update session with PAX filename
      if (currentSession) {
        try {
          await updateSession(currentSession.id, {
            paxFilename: result.paxFile,
          });
        } catch (error) {
          console.error('Failed to update session with PAX filename:', error);
        }
      }
      
      // Refresh output files to show the new PAX report for current ship
      queryClient.invalidateQueries({ queryKey: ["/api/output-files", currentShip] });
      
      // Refresh consolidated PAX reports to show the new consolidated report
      if (result.consolidatedPaxGenerated) {
        queryClient.invalidateQueries({ queryKey: ["/api/consolidated-pax-reports"] });
        console.log(`Updated consolidated PAX report: ${result.consolidatedFilename}`);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Failed to generate PAX report",
        description: error.message || "An error occurred while generating the PAX report.",
        variant: "destructive",
      });
    },
  });

  const handleUpdatePax = () => {
    updatePaxMutation.mutate();
  };

  // Update existing PAX report mutation
  const updateExistingPaxMutation = useMutation({
    mutationFn: async () => {
      if (!savedFileId) {
        throw new Error('No saved file ID available');
      }

      const response = await apiRequest("POST", "/api/add-successive-pax-entry", {
        dispatchFileId: savedFileId,
        shipId: currentShip!,
        selectedShipName: getSelectedShipName(currentShip!)
      });

      return response.json();
    },
    onSuccess: (result) => {
      setUpdatePaxFileName(result.paxFile);
      setShowUpdatePaxSuccessModal(true);
      
      // Refresh output files to show the updated PAX report for current ship
      queryClient.invalidateQueries({ queryKey: ["/api/output-files", currentShip] });
      
      // Refresh consolidated PAX reports to show the updated consolidated report
      if (result.consolidatedPaxGenerated) {
        queryClient.invalidateQueries({ queryKey: ["/api/consolidated-pax-reports"] });
        console.log(`Updated consolidated PAX report: ${result.consolidatedFilename}`);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update PAX report",
        description: error.message || "An error occurred while updating the existing PAX report.",
        variant: "destructive",
      });
    },
  });

  const handleUpdateExistingPax = () => {
    updateExistingPaxMutation.mutate();
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
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <SidebarNavigation />
      <MobileNavigation />
      
      <div 
        className={`flex-1 transition-all duration-300 ${
          isCollapsed ? 'md:ml-16' : 'md:ml-64'
        } flex flex-col`}
      >
        <Breadcrumbs />
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6">
          <div className="max-w-7xl mx-auto">
          {/* Ship Selector */}
          <div className="mb-4 sm:mb-6">
            <ShipSelector showShipNameDropdown={true} />
          </div>

          {/* Session Status Indicator */}
          {currentSession && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm font-medium text-green-800">
                    Active Session: {currentSession.id.slice(0, 8)}...
                  </span>
                </div>
                <span className="text-xs text-green-600">
                  Last activity: {new Date(currentSession.lastActivity).toLocaleTimeString()}
                </span>
              </div>
            </div>
          )}

          <div className="mb-4 sm:mb-6">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-2">
              Create New Dispatch Record
              {currentShip && (
                <span className="text-base sm:text-lg font-normal text-blue-600 block mt-1">
                  for {getShipDisplayName(currentShip)}
                </span>
              )}
            </h1>
            <p className="text-sm sm:text-base text-gray-600">
              {currentShip 
                ? `Edit the dispatch template spreadsheet to create a new record for ${getShipDisplayName(currentShip)}`
                : 'Please select a ship above to begin editing the dispatch template'
              }
            </p>
          </div>

          {!currentShip ? (
            <Card>
              <CardContent className="text-center py-6 sm:py-8">
                <AlertTriangle className="w-10 h-10 sm:w-12 sm:h-12 text-yellow-500 mx-auto mb-3 sm:mb-4" />
                <p className="text-sm sm:text-base text-gray-600 mb-3 sm:mb-4 px-2">Please select a ship above to begin creating dispatch records.</p>
                <p className="text-xs sm:text-sm text-gray-500 px-2">Each ship maintains separate templates and data for complete isolation.</p>
              </CardContent>
            </Card>
          ) : isLoadingDispatch ? (
            <Card>
              <CardContent className="flex items-center justify-center py-6 sm:py-8">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-blue-600 mx-auto mb-3 sm:mb-4"></div>
                  <p className="text-sm sm:text-base text-gray-600 px-2">Loading dispatch template for {getShipDisplayName(currentShip)}...</p>
                </div>
              </CardContent>
            </Card>
          ) : !dispatchTemplate ? (
            <Card>
              <CardContent className="text-center py-6 sm:py-8">
                <p className="text-sm sm:text-base text-gray-600 mb-3 sm:mb-4 px-2">No dispatch template found for {getShipDisplayName(currentShip)}. Please upload a template first.</p>
                <Button onClick={() => setLocation("/templates/edit")} className="text-sm sm:text-base">
                  Upload Template
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4 sm:space-y-6">
              {/* Template Information */}
              <Card className="shadow-sm border-gray-200 hover:shadow-md transition-shadow">
                <CardContent className="p-4 sm:p-6">
                  {/* Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-3 sm:mb-4">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate">Dispatch Template</h3>
                      <p className="text-xs sm:text-sm text-gray-500 truncate">{dispatchTemplate.originalFilename}</p>
                    </div>
                    
                    {/* Status Badge */}
                    {showUpdateEOD && (
                      <div className="shrink-0">
                        <span className="inline-flex items-center px-2 py-1 sm:px-2.5 sm:py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Ready for Reports
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-2 sm:space-y-3">
                    {!isEditing && !showUpdateEOD ? (
                      <Button 
                        onClick={handleEditSpreadsheet}
                        disabled={isLoading}
                        className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 font-medium text-sm py-3"
                        size="default"
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Edit Dispatch Sheet
                      </Button>
                    ) : isEditing ? (
                      <div className="space-y-2 sm:space-y-0 sm:flex sm:gap-3">
                        <Button 
                          onClick={handleSave}
                          disabled={isLoading}
                          className="w-full sm:flex-1 bg-green-600 hover:bg-green-700 font-medium text-sm py-3"
                          size="default"
                        >
                          <Save className="w-4 h-4 mr-2" />
                          {isLoading ? 'Saving Changes...' : 'Save Changes'}
                        </Button>
                        <Button 
                          onClick={handleCancel}
                          variant="outline"
                          disabled={isLoading}
                          className="w-full sm:flex-1 border-gray-300 hover:bg-gray-50 text-sm py-3"
                          size="default"
                        >
                          <X className="w-4 h-4 mr-2" />
                          Cancel
                        </Button>
                      </div>
                    ) : showUpdateEOD ? (
                      <div className="space-y-2 sm:space-y-0 sm:grid sm:grid-cols-3 sm:gap-3">
                        <Button 
                          onClick={handleUpdateEOD}
                          disabled={updateEODMutation.isPending}
                          className="w-full bg-purple-600 hover:bg-purple-700 font-medium text-sm py-3"
                          size="default"
                        >
                          <FileText className="w-4 h-4 mr-2" />
                          <span className="hidden sm:inline">{updateEODMutation.isPending ? 'Generating...' : 'Generate New EOD Report'}</span>
                          <span className="sm:hidden">{updateEODMutation.isPending ? 'Generating...' : 'Generate New EOD'}</span>
                        </Button>
                        <Button 
                          onClick={() => {
                            // Find the latest EOD file and add this entry to it
                            if (outputFiles?.length > 0) {
                              const latestEodFile = outputFiles
                                .filter((file: any) => file.filename.startsWith('eod_'))
                                .sort((a: any, b: any) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime())[0];
                              
                              if (latestEodFile && !latestEodFile.filename.includes(savedFileId)) {
                                successiveDispatchMutation.mutate(latestEodFile.filename);
                              }
                            }
                          }}
                          disabled={successiveDispatchMutation.isPending || !outputFiles?.some((file: any) => 
                            file.filename.startsWith('eod_') && !file.filename.includes(savedFileId)
                          )}
                          variant="outline"
                          className="w-full bg-blue-50 hover:bg-blue-100 border-blue-300 text-blue-700 font-medium text-sm py-3"
                          size="default"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          <span className="hidden sm:inline">{successiveDispatchMutation.isPending ? 'Updating...' : 'Update Existing EOD Report'}</span>
                          <span className="sm:hidden">{successiveDispatchMutation.isPending ? 'Updating...' : 'Update Existing EOD'}</span>
                        </Button>
                        <Button 
                          onClick={() => {
                            setShowUpdateEOD(false);
                            setSavedFileId(null);
                          }}
                          variant="outline"
                          className="w-full border-gray-300 hover:bg-gray-50 font-medium text-sm py-3"
                          size="default"
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          <span className="hidden sm:inline">Edit Again</span>
                          <span className="sm:hidden">Edit Again</span>
                        </Button>
                      </div>
                    ) : null}
                  </div>
                  
                  {/* Warning Notice */}
                  {hasUnsavedChanges && (
                    <div className="mt-3 sm:mt-4 p-2 sm:p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <div className="flex items-center">
                        <AlertTriangle className="w-3 h-3 sm:w-4 sm:h-4 text-amber-600 mr-2" />
                        <p className="text-xs sm:text-sm text-amber-800">You have unsaved changes</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* PAX Template Card - Only show when file is saved */}
              {showUpdateEOD && savedFileId && (
                <Card className="shadow-sm border-gray-200 hover:shadow-md transition-shadow">
                  <CardContent className="p-4 sm:p-6">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-3 sm:mb-4">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-base sm:text-lg font-semibold text-gray-900">PAX Template</h3>
                        <p className="text-xs sm:text-sm text-gray-500">Generate PAX reports from dispatch data</p>
                      </div>
                      
                      {/* Status Badge */}
                      <div className="shrink-0">
                        <span className="inline-flex items-center px-2 py-1 sm:px-2.5 sm:py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                          PAX Ready
                        </span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="space-y-2 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-3">
                      <Button 
                        onClick={handleUpdatePax}
                        disabled={updatePaxMutation.isPending}
                        className="w-full bg-orange-600 hover:bg-orange-700 font-medium text-sm py-3"
                        size="default"
                      >
                        <Users className="w-4 h-4 mr-2" />
                        <span className="hidden sm:inline">{updatePaxMutation.isPending ? 'Generating...' : 'Generate New PAX Report'}</span>
                        <span className="sm:hidden">{updatePaxMutation.isPending ? 'Generating...' : 'Generate New PAX'}</span>
                      </Button>
                      <Button 
                        onClick={handleUpdateExistingPax}
                        disabled={updateExistingPaxMutation.isPending}
                        variant="outline"
                        className="w-full border-orange-300 text-orange-700 hover:bg-orange-50 font-medium text-sm py-3"
                        size="default"
                      >
                        <FileText className="w-4 h-4 mr-2" />
                        <span className="hidden sm:inline">{updateExistingPaxMutation.isPending ? 'Updating...' : 'Update Existing PAX Report'}</span>
                        <span className="sm:hidden">{updateExistingPaxMutation.isPending ? 'Updating...' : 'Update Existing PAX'}</span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Spreadsheet Editor */}
              {isEditing && file && (
                <Card>
                  <CardContent className="p-4 sm:py-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-3 sm:mb-4">
                      <h3 className="text-base sm:text-lg font-semibold text-gray-900">Edit Dispatch Sheet</h3>
                      
                      {/* Horizontal Scroll Controls */}
                      <div className="flex items-center space-x-2">
                        <span className="text-xs sm:text-sm text-gray-600 mr-1 sm:mr-2 hidden sm:inline">
                          Scroll by {getColumnsToScroll()} columns:
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleScrollLeft}
                          disabled={!canScrollLeft}
                          className="flex items-center space-x-1 px-2 sm:px-3"
                        >
                          <ChevronLeft className="h-3 w-3 sm:h-4 sm:w-4" />
                          <span className="hidden sm:inline">Left</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleScrollRight}
                          disabled={!canScrollRight}
                          className="flex items-center space-x-1 px-2 sm:px-3"
                        >
                          <span className="hidden sm:inline">Right</span>
                          <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
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
                            
                            // No dropdown for B1 (row 0, col 1) - just text "CCL"
                            if (row === 0 && col === 1) {
                              // B1 should just contain "CCL" with no dropdown
                              cellProperties.readOnly = false; // Allow editing but no dropdown
                            }
                            
                            // Add dropdown for Ship Name cell (B2 = row 1, col 1)
                            if (row === 1 && col === 1) {
                              cellProperties.type = 'dropdown';
                              cellProperties.source = [
                                'LIBERTY', 'VISTA', 'FREEDOM', 'CONQUEST', 'GLORY', 'ELATION', 'PRIDE', 
                                'MARDI GRAS', 'CELEBRATION', 'HORIZON', 'DREAM', 'SUNRISE', 'VENEZIA', 
                                'MAGIC', 'PANORAMA', 'SUNSHINE', 'SPLENDOR', 'LEGEND', 'JUBILEE', 
                                'MIRACLE', 'FIRENZE', 'LUMINOSA', 'RADIANCE', 'SENSATION'
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

          {/* PAX Success Modal */}
          <Dialog open={showPaxSuccessModal} onOpenChange={setShowPaxSuccessModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center text-green-600">
              <CheckCircle className="w-6 h-6 mr-2" />
              PAX Report Generated!
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-gray-600 mb-4">
              Your PAX report has been successfully generated and is ready for download.
            </p>
            <div className="bg-gray-50 rounded-lg p-3 mb-4">
              <p className="text-sm font-medium text-gray-700">Generated File:</p>
              <p className="text-sm text-gray-600">{paxFileName}</p>
            </div>
            <div className="flex flex-col space-y-2">
              <div className="flex space-x-3">
                <Button 
                  onClick={() => {
                    setShowPaxSuccessModal(false);
                    setLocation("/consolidated-pax-reports");
                  }}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  View Consolidated PAX
                </Button>
                <Button 
                  onClick={() => {
                    setShowPaxSuccessModal(false);
                    setLocation("/reports");
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  View Reports
                </Button>
              </div>
              <Button 
                onClick={() => setShowPaxSuccessModal(false)}
                variant="outline"
                className="w-full"
              >
                Continue Here
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

          {/* Update PAX Success Modal */}
          <Dialog open={showUpdatePaxSuccessModal} onOpenChange={setShowUpdatePaxSuccessModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center text-green-600">
              <CheckCircle className="w-6 h-6 mr-2" />
              PAX Report Updated!
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-gray-600 mb-4">
              Your existing PAX report has been successfully updated with new data.
            </p>
            <div className="bg-gray-50 rounded-lg p-3 mb-4">
              <p className="text-sm font-medium text-gray-700">Updated File:</p>
              <p className="text-sm text-gray-600">{updatePaxFileName}</p>
            </div>
            <div className="flex flex-col space-y-2">
              <div className="flex space-x-3">
                <Button 
                  onClick={() => {
                    setShowUpdatePaxSuccessModal(false);
                    setLocation("/consolidated-pax-reports");
                  }}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  View Consolidated PAX
                </Button>
                <Button 
                  onClick={() => {
                    setShowUpdatePaxSuccessModal(false);
                    setLocation("/reports");
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  View Reports
                </Button>
              </div>
              <Button 
                onClick={() => setShowUpdatePaxSuccessModal(false)}
                variant="outline"
                className="w-full"
              >
                Continue Here
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* EOD Success Modal */}
      <Dialog open={showEodSuccessModal} onOpenChange={setShowEodSuccessModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center text-purple-600">
              <CheckCircle className="w-6 h-6 mr-2" />
              EOD Report Updated!
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-gray-600 mb-4">
              Your EOD report has been successfully updated with the new dispatch entry.
            </p>
            <div className="bg-gray-50 rounded-lg p-3 mb-4">
              <p className="text-sm font-medium text-gray-700">Updated File:</p>
              <p className="text-sm text-gray-600">{eodFileName}</p>
            </div>
            <div className="flex space-x-3">
              <Button 
                onClick={() => {
                  setShowEodSuccessModal(false);
                  setLocation("/reports");
                }}
                className="flex-1 bg-purple-600 hover:bg-purple-700"
              >
                View Reports
              </Button>
              <Button 
                onClick={() => setShowEodSuccessModal(false)}
                variant="outline"
                className="flex-1"
              >
                Continue Here
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
          </div>
        </div>
      </div>
    </div>
  );
}
