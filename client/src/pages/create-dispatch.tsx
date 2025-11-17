import { useState, useEffect, useRef, useMemo } from "react";
import { useLocation, useParams } from "wouter";

// UI
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { History, File, Eye, Download, Plus, FileText, ChevronLeft, ChevronRight, Users, CheckCircle, Edit, Save, X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

// Components
import { SidebarNavigation, MobileNavigation } from "@/components/sidebar-navigation";
import { ShipSelector } from "@/components/ship-selector";
import { Breadcrumbs } from "@/components/breadcrumbs";

// State / Contexts
import { useSidebar } from "@/contexts/sidebar-context";
import { useShipContext } from "@/contexts/ship-context";
import { useDispatchSession } from "@/contexts/dispatch-session-context";

// Third-party libraries
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
  const [validationErrors, setValidationErrors] = useState<Map<string, string>>(new Map());
  const [showValidationErrorModal, setShowValidationErrorModal] = useState(false);
  const lostPaxMergeConfig = useMemo(() => ([
    { row: 8, col: 19, rowspan: 1, colspan: 2 }
  ]), []);

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

  const enforceLostPaxHeading = (rows: SpreadsheetData): void => {
    if (!rows[8]) {
      rows[8] = [];
    }
    const headingValue = rows[8][19];
    if (typeof headingValue !== 'string' || headingValue.trim().length === 0) {
      rows[8][19] = 'Lost Pax';
    } else if (headingValue.toLowerCase() !== 'lost pax') {
      rows[8][19] = 'Lost Pax';
    }
    rows[8][20] = '';
  };

  const ensureLostPaxHeading = (rows: SpreadsheetData): SpreadsheetData => {
    const clonedRows = rows.map((row) => (Array.isArray(row) ? [...row] : []));
    enforceLostPaxHeading(clonedRows);
    return clonedRows;
  };

  const normalizeWorksheetData = (worksheet: XLSX.WorkSheet) => {
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    const actualColumnCount = range.e.c + 1;
    const actualRowCount = range.e.r + 1;

    const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
      header: 1, 
      range: worksheet['!ref'],
      defval: '',
      blankrows: true
    });

    const allRows = jsonData as SpreadsheetData;
    const extraRows = 10;
    const totalRowsWithExtra = actualRowCount + extraRows;
    const completeRows: SpreadsheetData = [];

    for (let r = 0; r < totalRowsWithExtra; r++) {
      const row = allRows[r] || [];
      const completeRow: (string | number)[] = [];
      
      for (let c = 0; c < actualColumnCount; c++) {
        let cellValue = row[c] !== undefined ? row[c] : '';

        if (c === 1 && r >= 10) {
          cellValue = convertExcelTimeToReadable(cellValue);
        }

        completeRow[c] = cellValue;
      }

      completeRows.push(completeRow);
    }

    const genericHeaders = Array.from({length: actualColumnCount}, (_, i) => {
      if (i < 26) {
        return String.fromCharCode(65 + i);
      } else {
        const firstLetter = String.fromCharCode(65 + Math.floor(i / 26) - 1);
        const secondLetter = String.fromCharCode(65 + (i % 26));
        return firstLetter + secondLetter;
      }
    });

    enforceLostPaxHeading(completeRows);

    return {
      rows: completeRows,
      headers: genericHeaders
    };
  };

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

      const { rows, headers } = normalizeWorksheetData(worksheet);

      setFile({
        name: dispatchTemplate.originalFilename,
        data: rows,
        headers
      });
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
    
    const dataWithHeading = ensureLostPaxHeading(file.data);
    setFile((prev) => (prev ? { ...prev, data: dataWithHeading } : prev));
    setEditedData(dataWithHeading);
    setIsEditing(true);
    setHasUnsavedChanges(false);
  };

  const handleDataChange = (changes: any) => {
    if (changes) {
      setHasUnsavedChanges(true);
    }
  };

  // Validation functions with specific error messages
  const numericValidator = (value: any, callback: (valid: boolean) => void) => {
    const isEmpty = value === null || value === undefined || value === '';
    if (isEmpty) {
      callback(true);
      return;
    }
    const isValid = !isNaN(Number(value)) && value.toString().trim() !== '';
    callback(isValid);
  };

  const textOnlyValidator = (value: any, callback: (valid: boolean) => void) => {
    const isEmpty = value === null || value === undefined || value === '';
    if (isEmpty) {
      callback(true);
      return;
    }
    const isValid = typeof value === 'string' && !/\d/.test(value);
    callback(isValid);
  };

  const dateTimeValidator = (value: any, callback: (valid: boolean) => void) => {
    const isEmpty = value === null || value === undefined || value === '';
    if (isEmpty) {
      callback(true);
      return;
    }
    const datePattern = /^(\d{1,2}\/\d{1,2}\/\d{4}|\d{1,2}:\d{2}\s*(AM|PM|am|pm)?)$/;
    const isValid = datePattern.test(String(value).trim());
    callback(isValid);
  };

  // Strict validator for B5: expects format like "22-oct-2025" (2-digit day, 3-letter month, 4-digit year, case-insensitive month)
  const b5DateValidator = (value: any, callback: (valid: boolean) => void) => {
    const isEmpty = value === null || value === undefined || value === '';
    if (isEmpty) {
      callback(true);
      return;
    }
    const str = String(value).trim();
    const monthRe = /Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/i;
    // Format: dd-mmm-yyyy (exactly 2 digits for day, 3-letter month, 4 digits for year)
    const pattern = /^\d{2}-(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-\d{4}$/i;
    const isValid = pattern.test(str) && monthRe.test(str.split('-')[1] || '');
    callback(isValid);
  };

  const strictTourNameValidator = (allowedName: string) => {
    return (value: any, callback: (valid: boolean) => void) => {
      const isEmpty = value === null || value === undefined || value === '';
      if (isEmpty) {
        callback(true);
        return;
      }
      const isValid = value === allowedName;
      callback(isValid);
    };
  };

  // Get error message for cell type
  const getErrorMessageForCell = (row: number, col: number): string => {
    // Numeric cells
    const numericCells = [
      {r: 10, c: 7}, {r: 12, c: 7}, {r: 14, c: 7},
      {r: 10, c: 9}, {r: 12, c: 9}, {r: 14, c: 9},
      {r: 10, c: 10}, {r: 12, c: 10}, {r: 14, c: 10},
      {r: 10, c: 11}, {r: 12, c: 11}, {r: 14, c: 11},
      {r: 10, c: 12}, {r: 12, c: 12}, {r: 14, c: 12},
      {r: 10, c: 16}, {r: 12, c: 16}, {r: 14, c: 16},
      {r: 10, c: 17}, {r: 12, c: 17}, {r: 14, c: 17}
    ];
    if (numericCells.some(cell => cell.r === row && cell.c === col)) {
      return 'Invalid input: numbers only';
    }
    
    // Text-only cells
    if ((row === 10 || row === 12 || row === 14) && col === 13) {
      return 'Invalid input: text only (no numbers)';
    }
    
    // B5 date cell - strict format required
    if (row === 4 && col === 1) {
      return 'Invalid format: use dd-mmm-yyyy (e.g., 22-oct-2025). Month can be upper or lower case.';
    }
    
    // Date/Time cells for B11, B13, B15
    if ((row === 10 || row === 12 || row === 14) && col === 1) {
      return 'Invalid format: use DD/MM/YYYY or HH:MM AM/PM';
    }
    
    // Strict tour name cells
    if (row === 10 && col === 0) {
      return 'Must be: "Catamaran Sail & Snorkel"';
    }
    if (row === 12 && col === 0) {
      return 'Must be: "Champagne Adults Only"';
    }
    if (row === 14 && col === 0) {
      return 'Must be: "Invisible Boat Family"';
    }
    
    return 'Invalid value';
  };

  // Validate all cells before saving, especially B5
  const validateAllCells = async (): Promise<boolean> => {
    // Start with existing errors to preserve validation state for other cells
    const newErrors = new Map(validationErrors);
    const hotInstance = hotTableRef.current?.hotInstance;
    
    // Validate B5 (row 4, col 1) - Date cell
    if (editedData.length > 4 && editedData[4]) {
      const b5Value = editedData[4][1];
      const b5Row = 4;
      const b5Col = 1;
      const cellKey = `${b5Row},${b5Col}`;
      
      // Use Promise to handle async validator
      const b5IsValid = await new Promise<boolean>((resolve) => {
        b5DateValidator(b5Value, (isValid) => {
          resolve(isValid);
        });
      });
      
      if (!b5IsValid) {
        const errorMessage = getErrorMessageForCell(b5Row, b5Col);
        newErrors.set(cellKey, errorMessage);
        
        // Update UI to show error
        if (hotInstance) {
          const td = hotInstance.getCell(b5Row, b5Col);
          if (td) {
            td.classList.add('htInvalid');
            td.setAttribute('data-validation-type', 'error');
            td.setAttribute('title', errorMessage);
          }
        }
      } else {
        // Clear error if valid
        newErrors.delete(cellKey);
        if (hotInstance) {
          const td = hotInstance.getCell(b5Row, b5Col);
          if (td) {
            td.classList.remove('htInvalid');
            td.removeAttribute('data-validation-type');
            td.removeAttribute('title');
          }
        }
      }
    }
    
    // Update validation errors state
    setValidationErrors(newErrors);
    
    // Re-render to show validation errors
    if (hotInstance) {
      hotInstance.render();
    }
    
    return newErrors.size === 0;
  };

  const handleSave = async () => {
    if (!editedData.length) return;
    
    // Validate all cells before saving
    const isValid = await validateAllCells();
    
    // Check for validation errors before saving
    if (!isValid) {
      setShowValidationErrorModal(true);
      return;
    }
    
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
    setValidationErrors(new Map());
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
      
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const { rows, headers } = normalizeWorksheetData(worksheet);
      
      setFile({
        name: version.originalFilename,
        data: rows,
        headers
      });
      setEditedData(rows);
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
                    
                    {/* Validation Error Counter */}
                    {validationErrors.size > 0 && (
                      <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-red-800">
                              {validationErrors.size} validation error{validationErrors.size !== 1 ? 's' : ''} found
                            </p>
                            <p className="text-xs text-red-600 mt-0.5">
                              Hover over cells with red borders to see specific error messages
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                    
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
                          mergeCells={lostPaxMergeConfig}
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
                            const cellValue = editedData?.[row]?.[col];
                            
                            // Lock all cells in column A (tour names)
                            if (col === 0) {
                              cellProperties.readOnly = true;
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

                            if (row === 8 && (col === 19 || col === 20) && typeof cellValue === 'string' && cellValue.toLowerCase().includes('lost pax')) {
                              classNames.push('lost-pax-heading-cell');
                            }

                            if (col === 19 && [9, 10, 11].includes(row) && typeof cellValue === 'string') {
                              const normalizedValue = cellValue.trim().toLowerCase();
                              if (['weather', 'operational', 'notes'].includes(normalizedValue)) {
                                classNames.push('lost-pax-subheading-cell');
                              }
                            }
                            
                            // NEW TEMPLATE STRUCTURE (Bahamas/Dominican Republic)
                            
                            // B1 (row 0, col 1): Country - dropdown
                            if (row === 0 && col === 1) {
                              cellProperties.type = 'dropdown';
                              cellProperties.source = ['Bahamas', 'Dominican Republic', 'Jamaica', 'Mexico', 'Cayman Islands'];
                              cellProperties.strict = false;
                              cellProperties.allowInvalid = true;
                            }
                            
                            // B2 (row 1, col 1): Cruise Line - plain text
                            if (row === 1 && col === 1) {
                              cellProperties.readOnly = false; // Allow editing
                            }
                            
                            // B3 (row 2, col 1): Ship Name - dropdown (MOVED FROM B2)
                            if (row === 2 && col === 1) {
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
                            
                            // E3 (row 2, col 4): Port - dropdown
                            if (row === 2 && col === 4) {
                              cellProperties.type = 'dropdown';
                              cellProperties.source = ['Taino Bay', 'Amber Cove'];
                              cellProperties.strict = true;
                              cellProperties.allowInvalid = false;
                            }
                            
                            // VALIDATION RULES
                            // Numeric cells: H11, H13, H15, J11, J13, J15, K11, K13, K15, L11, L13, L15, M11, M13, M15, Q11, Q13, Q15, R11, R13, R15
                            const numericCells = [
                              {r: 10, c: 7}, {r: 12, c: 7}, {r: 14, c: 7},  // H11, H13, H15
                              {r: 10, c: 9}, {r: 12, c: 9}, {r: 14, c: 9},  // J11, J13, J15
                              {r: 10, c: 10}, {r: 12, c: 10}, {r: 14, c: 10}, // K11, K13, K15
                              {r: 10, c: 11}, {r: 12, c: 11}, {r: 14, c: 11}, // L11, L13, L15
                              {r: 10, c: 12}, {r: 12, c: 12}, {r: 14, c: 12}, // M11, M13, M15
                              {r: 10, c: 16}, {r: 12, c: 16}, {r: 14, c: 16}, // Q11, Q13, Q15
                              {r: 10, c: 17}, {r: 12, c: 17}, {r: 14, c: 17}  // R11, R13, R15
                            ];
                            
                            if (numericCells.some(cell => cell.r === row && cell.c === col)) {
                              cellProperties.validator = numericValidator;
                              cellProperties.allowInvalid = true;
                            }
                            
                            // Text-only cells: N11, N13, N15
                            if ((row === 10 || row === 12 || row === 14) && col === 13) {
                              cellProperties.validator = textOnlyValidator;
                              cellProperties.allowInvalid = true;
                            }
                            
                            // Date/Time cells: B11, B13, B15 use relaxed time/date validator
                            if (((row === 10 || row === 12 || row === 14) && col === 1)) {
                              cellProperties.validator = dateTimeValidator;
                              cellProperties.allowInvalid = true;
                            }
                            // B5 uses strict "dd-mmm-yyyy" validator (e.g., 22-oct-2025, month can be upper or lower case)
                            if (row === 4 && col === 1) {
                              cellProperties.validator = b5DateValidator;
                              cellProperties.allowInvalid = true;
                            }
                            
                            // Strict tour name cells
                            if (row === 10 && col === 0) { // A11
                              cellProperties.validator = strictTourNameValidator('Catamaran Sail & Snorkel');
                              cellProperties.allowInvalid = true;
                            }
                            if (row === 12 && col === 0) { // A13
                              cellProperties.validator = strictTourNameValidator('Champagne Adults Only');
                              cellProperties.allowInvalid = true;
                            }
                            if (row === 14 && col === 0) { // A15
                              cellProperties.validator = strictTourNameValidator('Invisible Boat Family');
                              cellProperties.allowInvalid = true;
                            }
                            
                            cellProperties.className = classNames.join(' ');
                            return cellProperties;
                          }}
                          afterValidate={(isValid, value, row, prop) => {
                            const col = typeof prop === 'number' ? prop : 0;
                            const cellKey = `${row},${col}`;
                            const hotInstance = hotTableRef.current?.hotInstance;
                            
                            if (hotInstance) {
                              const td = hotInstance.getCell(row, col);
                              if (td) {
                                if (!isValid) {
                                  const errorMessage = getErrorMessageForCell(row, col);
                                  td.classList.add('htInvalid');
                                  td.setAttribute('data-validation-type', 'error');
                                  td.setAttribute('title', errorMessage);
                                  const newErrors = new Map(validationErrors);
                                  newErrors.set(cellKey, errorMessage);
                                  setValidationErrors(newErrors);
                                } else {
                                  td.classList.remove('htInvalid');
                                  td.removeAttribute('data-validation-type');
                                  td.removeAttribute('title');
                                  const newErrors = new Map(validationErrors);
                                  newErrors.delete(cellKey);
                                  setValidationErrors(newErrors);
                                }
                              }
                            }
                            return isValid;
                          }}
                          afterRenderer={(TD, row, col, prop, value, cellProperties) => {
                            const cellKey = `${row},${col}`;
                            if (validationErrors.has(cellKey)) {
                              const errorMessage = validationErrors.get(cellKey) || 'Invalid value';
                              TD.classList.add('htInvalid');
                              TD.setAttribute('data-validation-type', 'error');
                              TD.setAttribute('title', errorMessage);
                            }
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

      {/* Validation Error Modal */}
      <Dialog open={showValidationErrorModal} onOpenChange={setShowValidationErrorModal}>
        <DialogContent className="max-w-md z-[9999]">
          <DialogHeader>
            <DialogTitle className="flex items-center text-red-600">
              <AlertTriangle className="w-6 h-6 mr-2" />
              Validation Errors
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-gray-600 mb-4">
              Please fix the following validation errors before saving:
            </p>
            <div className="bg-red-50 rounded-lg p-3 mb-4 max-h-60 overflow-y-auto">
              <ul className="list-disc list-inside space-y-1 text-sm text-red-700">
                {Array.from(validationErrors.entries()).map(([cellKey, error]) => (
                  <li key={cellKey}>Cell {cellKey}: {error}</li>
                ))}
              </ul>
            </div>
            <Button 
              onClick={() => setShowValidationErrorModal(false)}
              className="w-full"
            >
              Fix Errors
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <style>{`
        .lost-pax-heading-cell {
          font-weight: 700;
          text-align: center !important;
          border: 2px solid #0f172a !important;
          background-color: #f1f5f9 !important;
          text-transform: uppercase;
        }

        .lost-pax-subheading-cell {
          font-weight: 600;
          border: 2px solid #0f172a !important;
          background-color: #f8fafc !important;
          text-align: left !important;
          padding-left: 8px !important;
        }

        /* Validation styling - Excel-themed with thin red border */
        .htInvalid {
          border: 1px solid #dc2626 !important;
          background-color: transparent !important;
          background: transparent !important;
          background-image: none !important;
          position: relative;
        }
        
        /* Override Handsontable's default invalid cell background */
        td.htInvalid {
          background-color: transparent !important;
          background: transparent !important;
          background-image: none !important;
        }
        
        /* More specific override for area cells */
        .handsontable td.htInvalid,
        .handsontable tbody td.htInvalid {
          background-color: transparent !important;
          background: transparent !important;
          background-image: none !important;
        }
        
        .htInvalid::after {
          content: "✕";
          position: absolute;
          top: 2px;
          right: 4px;
          color: #dc2626;
          font-size: 10px;
          font-weight: bold;
          pointer-events: none;
        }
        
        /* Ensure hover shows pointer cursor for cells with validation errors */
        .htInvalid:hover {
          background-color: transparent !important;
          background: transparent !important;
          background-image: none !important;
        }
        
        /* Override on focus/active states */
        .htInvalid.area,
        .htInvalid:focus,
        .htInvalid.current {
          background-color: transparent !important;
          background: transparent !important;
          background-image: none !important;
        }
        
        /* Z-index fixes for validation modal */
        .ht_clone_top,
        .ht_clone_left,
        .ht_clone_bottom,
        .ht_clone_top_left_corner,
        .ht_clone_bottom_left_corner {
          z-index: 100 !important;
        }
        
        [data-radix-dialog-overlay] {
          z-index: 9998 !important;
        }
        
        [data-radix-dialog-content] {
          z-index: 9999 !important;
        }
      `}</style>
          </div>
        </div>
      </div>
    </div>
  );
}
