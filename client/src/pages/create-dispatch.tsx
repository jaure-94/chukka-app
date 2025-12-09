import { useState, useEffect, useRef, useMemo } from "react";
import { useLocation, useParams } from "wouter";

// UI
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { History, File, Eye, Download, Plus, FileText, ChevronLeft, ChevronRight, Users, CheckCircle, Edit, Save, X, AlertTriangle, Maximize2, Minimize2, RotateCw } from "lucide-react";
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
import { useIsMobile } from "@/hooks/use-mobile";
// Dispatch session functionality temporarily disabled
// import { useDispatchSession } from "@/contexts/dispatch-session-context";

// Third-party libraries
import { HotTable } from "@handsontable/react";
import type { HotTableClass } from "@handsontable/react";
import { registerAllModules } from "handsontable/registry";
import Handsontable from "handsontable";
import "handsontable/dist/handsontable.full.min.css";
import "react-day-picker/dist/style.css";
import { B5DateEditor, tryFormatToB5 } from "@/components/handsontable/b5-date-editor";
import * as XLSX from "xlsx";

// Register Handsontable modules
registerAllModules();

// Register custom B5 date picker editor at module level (standard for Handsontable editors)
// This is safe - editors are stateless and don't interfere with component lifecycle
Handsontable.editors.registerEditor('b5DateEditor', B5DateEditor);

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
  const isMobile = useIsMobile();
  // Dispatch session functionality temporarily disabled
  // const { currentSession, createSession, updateSession, getActiveSession, hasActiveSession } = useDispatchSession();
  const hotTableRef = useRef<HotTableClass>(null);
  
  // Extract ship from URL params (/create-dispatch/ship-a)
  const shipFromUrl = params.ship as string;
  // Dispatch session functionality temporarily disabled
  // const sessionFromUrl = params.sessionId as string;
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
  // Dispatch session functionality temporarily disabled
  // const [sessionInitialized, setSessionInitialized] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Map<string, string>>(new Map());
  const [showValidationErrorModal, setShowValidationErrorModal] = useState(false);
  // Use a ref to store current validation errors for immediate access (avoids async state update issues)
  const validationErrorsRef = useRef<Map<string, string>>(new Map());
  // Use a ref to store savedFileId for immediate access (avoids async state update issues on mobile)
  const savedFileIdRef = useRef<string | null>(null);
  const [spreadsheetViewMode, setSpreadsheetViewMode] = useState<'mobile' | 'landscape'>('mobile');
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
    // Add at least 2 extra columns to accommodate merged "Lost Pax" cells (needs column U)
    // The merged cell spans from column T (19) to U (20), so we need at least column 20
    const extraColumns = Math.max(2, 21 - actualColumnCount); // Ensure we have at least 21 columns (A-U)
    const totalColumnCount = actualColumnCount + extraColumns;
    const totalRowsWithExtra = actualRowCount + extraRows;
    const completeRows: SpreadsheetData = [];

    for (let r = 0; r < totalRowsWithExtra; r++) {
      const row = allRows[r] || [];
      const completeRow: (string | number)[] = [];
      
      for (let c = 0; c < totalColumnCount; c++) {
        let cellValue = row[c] !== undefined ? row[c] : '';

        if (c === 1 && r >= 10) {
          cellValue = convertExcelTimeToReadable(cellValue);
        }

        completeRow[c] = cellValue;
      }

      completeRows.push(completeRow);
    }

    const genericHeaders = Array.from({length: totalColumnCount}, (_, i) => {
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
    // Dispatch session functionality temporarily disabled
    // const initializeSession = async () => {
    //   if (!shipToUse || sessionInitialized) return;
    //   
    //   try {
    //     if (sessionFromUrl) {
    //       if (!currentSession || currentSession.id !== sessionFromUrl) {
    //         console.log('Session from URL not matching current session');
    //       }
    //     } else {
    //       const activeSession = await getActiveSession(shipToUse);
    //       if (activeSession) {
    //         setLocation(`/create-dispatch/${shipToUse}/${activeSession.id}`);
    //         return;
    //       }
    //     }
    //     setSessionInitialized(true);
    //   } catch (error) {
    //     console.error('Error initializing session:', error);
    //     setSessionInitialized(true);
    //   }
    // };

    // initializeSession();
  }, [shipToUse]);

  // Cleanup Handsontable instance when component unmounts
  useEffect(() => {
    return () => {
      // Cleanup function: destroy Handsontable instance on unmount
      const hotInstance = hotTableRef.current?.hotInstance;
      if (hotInstance) {
        try {
          hotInstance.destroy();
        } catch (error) {
          // Silently handle errors during cleanup (instance may already be destroyed)
          // This is expected and safe to ignore
        }
      }
    };
  }, []); // Only run on unmount

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
      // Check if filePath is a blob URL (Vercel Blob Storage)
      const isBlobUrl = dispatchTemplate.filePath.startsWith('https://') && 
                       (dispatchTemplate.filePath.includes('blob.vercel-storage.com') || 
                        dispatchTemplate.filePath.includes('public.blob.vercel-storage.com'));
      
      let response: Response;
      if (isBlobUrl) {
        // Fetch directly from blob URL
        response = await fetch(dispatchTemplate.filePath);
      } else {
        // Fetch from local API endpoint
        response = await fetch(`/api/files/${dispatchTemplate.filename}`);
      }
      
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

  // Normalize B5 pasted/typed values to dd-MMM-yyyy where possible
  const normalizeB5Changes = (changes: any[]) => {
    if (!changes) return;
    changes.forEach((change) => {
      const [row, prop, , newValue] = change;
      const col = typeof prop === 'number' ? prop : Number(prop);
      if (row === 4 && col === 1) {
        const formatted = tryFormatToB5(newValue);
        if (formatted) {
          change[3] = formatted;
        }
      }
    });
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

  // Validate all cells before saving
  const validateAllCells = async (): Promise<boolean> => {
    // Clear all existing errors first - start fresh
    const newErrors = new Map<string, string>();
    const hotInstance = hotTableRef.current?.hotInstance;
    
    // Helper function to get cell value - prefer Handsontable instance if available (more accurate on mobile)
    // Also syncs with editedData to ensure we have the latest value
    const getCellValue = (row: number, col: number): any => {
      let value: any = '';
      
      // First, try to get from editedData (source of truth)
      if (editedData[row] && editedData[row][col] !== undefined) {
        value = editedData[row][col];
      }
      
      // Then, try to get from Handsontable instance (may have more recent edits)
      if (hotInstance) {
        try {
          const hotValue = hotInstance.getDataAtCell(row, col);
          // If Handsontable has a value and it's different, prefer it (more recent)
          if (hotValue !== null && hotValue !== undefined && hotValue !== '') {
            value = hotValue;
          }
        } catch (error) {
          // Instance may be destroyed or unavailable - use editedData value
        }
      }
      
      return value;
    };
    
    // Helper function to validate a cell
    const validateCell = async (
      row: number,
      col: number,
      validator: (value: any, callback: (valid: boolean) => void) => void
    ): Promise<boolean> => {
      const cellValue = getCellValue(row, col);
      return new Promise<boolean>((resolve) => {
        validator(cellValue, (isValid) => {
          resolve(isValid);
        });
      });
    };
    
    // Helper function to update cell error state in UI
    const updateCellErrorState = (row: number, col: number, hasError: boolean, errorMessage?: string) => {
        if (hotInstance) {
        try {
          const td = hotInstance.getCell(row, col);
          if (td) {
            if (hasError && errorMessage) {
            td.classList.add('htInvalid');
            td.setAttribute('data-validation-type', 'error');
            td.setAttribute('title', errorMessage);
      } else {
            td.classList.remove('htInvalid');
            td.removeAttribute('data-validation-type');
            td.removeAttribute('title');
          }
        }
        } catch (error) {
          // Instance may be destroyed or unavailable - this is safe to ignore
          // during cleanup or when component is unmounting
        }
      }
    };
    
    // Validate all cells with validators
    const validationTasks: Promise<void>[] = [];
    
    // Validate B5 (row 4, col 1) - Date cell with strict format
    if (editedData.length > 4) {
      const b5Row = 4;
      const b5Col = 1;
      const cellKey = `${b5Row},${b5Col}`;
      
      validationTasks.push(
        validateCell(b5Row, b5Col, b5DateValidator).then((isValid) => {
          if (!isValid) {
            const errorMessage = getErrorMessageForCell(b5Row, b5Col);
            newErrors.set(cellKey, errorMessage);
            updateCellErrorState(b5Row, b5Col, true, errorMessage);
          } else {
            updateCellErrorState(b5Row, b5Col, false);
          }
        })
      );
    }
    
    // Validate numeric cells: H11, H13, H15, J11, J13, J15, K11, K13, K15, L11, L13, L15, M11, M13, M15, Q11, Q13, Q15, R11, R13, R15
    const numericCells = [
      {r: 10, c: 7}, {r: 12, c: 7}, {r: 14, c: 7},  // H11, H13, H15
      {r: 10, c: 9}, {r: 12, c: 9}, {r: 14, c: 9},  // J11, J13, J15
      {r: 10, c: 10}, {r: 12, c: 10}, {r: 14, c: 10}, // K11, K13, K15
      {r: 10, c: 11}, {r: 12, c: 11}, {r: 14, c: 11}, // L11, L13, L15
      {r: 10, c: 12}, {r: 12, c: 12}, {r: 14, c: 12}, // M11, M13, M15
      {r: 10, c: 16}, {r: 12, c: 16}, {r: 14, c: 16}, // Q11, Q13, Q15
      {r: 10, c: 17}, {r: 12, c: 17}, {r: 14, c: 17}  // R11, R13, R15
    ];
    
    numericCells.forEach(({r, c}) => {
      if (editedData.length > r) {
        const cellKey = `${r},${c}`;
        validationTasks.push(
          validateCell(r, c, numericValidator).then((isValid) => {
            if (!isValid) {
              const errorMessage = getErrorMessageForCell(r, c);
              newErrors.set(cellKey, errorMessage);
              updateCellErrorState(r, c, true, errorMessage);
            } else {
              updateCellErrorState(r, c, false);
            }
          })
        );
      }
    });
    
    // Validate text-only cells: N11, N13, N15
    [10, 12, 14].forEach((row) => {
      const col = 13;
      if (editedData.length > row) {
        const cellKey = `${row},${col}`;
        validationTasks.push(
          validateCell(row, col, textOnlyValidator).then((isValid) => {
            if (!isValid) {
              const errorMessage = getErrorMessageForCell(row, col);
              newErrors.set(cellKey, errorMessage);
              updateCellErrorState(row, col, true, errorMessage);
            } else {
              updateCellErrorState(row, col, false);
            }
          })
        );
      }
    });
    
    // Validate Date/Time cells: B11, B13, B15
    [10, 12, 14].forEach((row) => {
      const col = 1;
      if (editedData.length > row) {
        const cellKey = `${row},${col}`;
        validationTasks.push(
          validateCell(row, col, dateTimeValidator).then((isValid) => {
            if (!isValid) {
              const errorMessage = getErrorMessageForCell(row, col);
              newErrors.set(cellKey, errorMessage);
              updateCellErrorState(row, col, true, errorMessage);
            } else {
              updateCellErrorState(row, col, false);
            }
          })
        );
      }
    });
    
    // Validate strict tour name cells: A11, A13, A15
    const tourNameCells = [
      {r: 10, c: 0, name: 'Catamaran Sail & Snorkel'},
      {r: 12, c: 0, name: 'Champagne Adults Only'},
      {r: 14, c: 0, name: 'Invisible Boat Family'}
    ];
    
    tourNameCells.forEach(({r, c, name}) => {
      if (editedData.length > r) {
        const cellKey = `${r},${c}`;
        validationTasks.push(
          validateCell(r, c, strictTourNameValidator(name)).then((isValid) => {
            if (!isValid) {
              const errorMessage = getErrorMessageForCell(r, c);
              newErrors.set(cellKey, errorMessage);
              updateCellErrorState(r, c, true, errorMessage);
            } else {
              updateCellErrorState(r, c, false);
            }
          })
        );
      }
    });
    
    // Wait for all validations to complete
    await Promise.all(validationTasks);
    
    // Update both ref (for immediate access) and state (for React reactivity)
    validationErrorsRef.current = newErrors;
    setValidationErrors(newErrors);
    
    // Re-render to show validation errors
    if (hotInstance) {
      try {
      hotInstance.render();
      } catch (error) {
        // Instance may be destroyed or unavailable - this is safe to ignore
        // during cleanup or when component is unmounting
      }
    }
    
    // Log validation results for debugging (especially useful on mobile)
    if (newErrors.size > 0) {
      console.log(`Validation found ${newErrors.size} error(s):`, Array.from(newErrors.entries()));
    } else {
      console.log('All cells validated successfully');
    }
    
    return newErrors.size === 0;
  };

  const handleSave = async () => {
    if (!editedData.length) return;
    
    // Ensure Handsontable instance is ready (especially important on mobile)
    const hotInstance = hotTableRef.current?.hotInstance;
    if (!hotInstance) {
      console.warn('Handsontable instance not ready, waiting...');
      // Wait a bit for Handsontable to initialize (common on mobile)
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Try again after wait
      if (!hotTableRef.current?.hotInstance) {
        toast({
          title: "Error",
          description: "Spreadsheet not ready. Please try again.",
          variant: "destructive",
        });
        return;
      }
    }
    
    // Force Handsontable to update its internal data from the DOM
    // This ensures we get the latest cell values, especially important on mobile
    if (hotInstance) {
      try {
        // Force Handsontable to sync its data
        hotInstance.render();
        // Small delay to ensure DOM is updated
        await new Promise(resolve => setTimeout(resolve, 50));
      } catch (error) {
        console.warn('Error forcing Handsontable render before validation:', error);
      }
    }
    
    // Validate all cells before saving
    const isValid = await validateAllCells();
    
    // Check for validation errors before saving
    if (!isValid) {
      // Use a small delay to ensure state is updated before showing modal
      await new Promise(resolve => setTimeout(resolve, 50));
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
      // Update both ref (for immediate access) and state (for React reactivity)
      // This is especially important on mobile where state updates can be delayed
      savedFileIdRef.current = result.file.id;
      setSavedFileId(result.file.id);
      
      console.log('Dispatch sheet saved successfully. File ID:', result.file.id);
      
      // Dispatch session functionality temporarily disabled
      // Will be re-implemented later
      
      // Wait a bit for any pending scroll events to complete (especially important on mobile)
      // This prevents "instance has been destroyed" errors from momentum scrolling
      // Mobile devices have momentum scrolling that can fire events after user interaction
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Properly destroy Handsontable instance before unmounting
      // This prevents errors from momentum scroll events on mobile
      const hotInstance = hotTableRef.current?.hotInstance;
      if (hotInstance) {
        try {
          // Remove all event listeners and clean up
          hotInstance.destroy();
        } catch (error) {
          // Instance may already be destroyed, which is fine
          console.warn('Error destroying Handsontable instance (may already be destroyed):', error);
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
    const emptyErrors = new Map();
    validationErrorsRef.current = emptyErrors;
    setValidationErrors(emptyErrors);
    // Clear saved file ID ref when canceling
    savedFileIdRef.current = null;
  };

  // Update EOD Report mutation
  const updateEODMutation = useMutation({
    mutationFn: async () => {
      // Use ref for immediate access (important on mobile)
      const fileId = savedFileIdRef.current || savedFileId;
      
      if (!fileId) {
        console.error('No saved file ID available for EOD generation');
        throw new Error('No saved file ID available. Please save the dispatch sheet first.');
      }

      console.log('Generating new EOD report with file ID:', fileId, 'for ship:', shipToUse);

      const response = await apiRequest("POST", "/api/process-eod-from-dispatch", {
        dispatchFileId: fileId,
        shipId: shipToUse
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(errorData.message || `HTTP ${response.status}: Failed to generate EOD report`);
      }

      return response.json();
    },
    onSuccess: async (result) => {
      setEodFileName(result.eodFile);
      setShowEodSuccessModal(true);
      
      // Update session with EOD filename
      // Dispatch session functionality temporarily disabled
      
      // Invalidate all related caches for current ship
      queryClient.invalidateQueries({ queryKey: ["/api/generated-reports", currentShip] });
      queryClient.invalidateQueries({ queryKey: ["/api/dispatch-versions", currentShip] });
      queryClient.invalidateQueries({ queryKey: ["/api/output-files", currentShip] });
    },
    onError: (error: any) => {
      console.error("Error updating EOD report:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to generate EOD report. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleUpdateEOD = () => {
    updateEODMutation.mutate();
  };

  // Successive dispatch entry mutation
  const successiveDispatchMutation = useMutation({
    mutationFn: async (existingEodFilename: string) => {
      // Use ref for immediate access (important on mobile)
      const fileId = savedFileIdRef.current || savedFileId;
      
      if (!fileId) {
        console.error('No saved file ID available for successive dispatch');
        throw new Error('No saved file ID available. Please save the dispatch sheet first.');
      }

      if (!existingEodFilename) {
        console.error('No existing EOD filename provided');
        throw new Error('No existing EOD file found. Please generate a new EOD report first.');
      }

      console.log('Updating existing EOD report:', existingEodFilename, 'with file ID:', fileId, 'for ship:', shipToUse);

      const response = await apiRequest("POST", "/api/add-successive-dispatch", {
        dispatchFileId: fileId,
        existingEodFilename: existingEodFilename,
        shipId: shipToUse
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(errorData.message || `HTTP ${response.status}: Failed to update EOD report`);
      }

      return response.json();
    },
    onSuccess: (result) => {
      setEodFileName(result.eodFile);
      setShowEodSuccessModal(true);
      
      // Invalidate all related caches for current ship
      queryClient.invalidateQueries({ queryKey: ["/api/generated-reports", shipToUse] });
      queryClient.invalidateQueries({ queryKey: ["/api/dispatch-versions", shipToUse] });
      queryClient.invalidateQueries({ queryKey: ["/api/output-files", shipToUse] });
      
      // Also refresh consolidated PAX reports since successive dispatch triggers consolidated PAX
      queryClient.invalidateQueries({ queryKey: ["/api/consolidated-pax-reports"] });
      queryClient.invalidateQueries({ queryKey: ["/api/consolidated-pax-reports/latest"] });
      
      console.log('EOD report updated successfully:', result.eodFile);
    },
    onError: (error: any) => {
      console.error("Error adding successive dispatch entry:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update existing EOD report. Please try again.",
        variant: "destructive",
      });
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
      // Use ref for immediate access (important on mobile)
      const fileId = savedFileIdRef.current || savedFileId;
      
      if (!fileId) {
        console.error('No saved file ID available for PAX generation');
        throw new Error('No saved file ID available. Please save the dispatch sheet first.');
      }

      console.log('Generating new PAX report with file ID:', fileId, 'for ship:', shipToUse);

      const response = await apiRequest("POST", "/api/generate-pax-report", {
        dispatchFileId: fileId,
        shipId: shipToUse
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(errorData.message || `HTTP ${response.status}: Failed to generate PAX report`);
      }

      return response.json();
    },
    onSuccess: async (result) => {
      setPaxFileName(result.paxFile);
      setShowPaxSuccessModal(true);
      
      // Update session with PAX filename
      // Dispatch session functionality temporarily disabled
      
      // Refresh output files to show the new PAX report for current ship
      queryClient.invalidateQueries({ queryKey: ["/api/output-files", shipToUse] });
      
      // Refresh consolidated PAX reports to show the new consolidated report
      if (result.consolidatedPaxGenerated) {
        queryClient.invalidateQueries({ queryKey: ["/api/consolidated-pax-reports"] });
        queryClient.invalidateQueries({ queryKey: ["/api/consolidated-pax-reports/latest"] });
        console.log(`Updated consolidated PAX report: ${result.consolidatedFilename}`);
      }
      
      console.log('PAX report generated successfully:', result.paxFile);
    },
    onError: (error: any) => {
      console.error("Error generating PAX report:", error);
      toast({
        title: "Failed to generate PAX report",
        description: error.message || "An error occurred while generating the PAX report. Please try again.",
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
      // Use ref for immediate access (important on mobile)
      const fileId = savedFileIdRef.current || savedFileId;
      
      if (!fileId) {
        console.error('No saved file ID available for successive PAX entry');
        throw new Error('No saved file ID available. Please save the dispatch sheet first.');
      }

      console.log('Updating existing PAX report with file ID:', fileId, 'for ship:', shipToUse);

      const response = await apiRequest("POST", "/api/add-successive-pax-entry", {
        dispatchFileId: fileId,
        shipId: shipToUse,
        selectedShipName: getSelectedShipName(shipToUse)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(errorData.message || `HTTP ${response.status}: Failed to update PAX report`);
      }

      return response.json();
    },
    onSuccess: (result) => {
      setUpdatePaxFileName(result.paxFile);
      setShowUpdatePaxSuccessModal(true);
      
      // Refresh output files to show the updated PAX report for current ship
      queryClient.invalidateQueries({ queryKey: ["/api/output-files", shipToUse] });
      
      // Refresh consolidated PAX reports to show the updated consolidated report
      if (result.consolidatedPaxGenerated) {
        queryClient.invalidateQueries({ queryKey: ["/api/consolidated-pax-reports"] });
        queryClient.invalidateQueries({ queryKey: ["/api/consolidated-pax-reports/latest"] });
        console.log(`Updated consolidated PAX report: ${result.consolidatedFilename}`);
      }
      
      console.log('PAX report updated successfully:', result.paxFile);
    },
    onError: (error: any) => {
      console.error("Error updating PAX report:", error);
      toast({
        title: "Failed to update PAX report",
        description: error.message || "An error occurred while updating the existing PAX report. Please try again.",
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
      {/* Fixed Desktop Sidebar - Hidden on Mobile */}
      <div className="hidden md:block fixed left-0 top-0 h-full z-10">
        <SidebarNavigation />
      </div>

      {/* Main Content Area */}
      <div 
        className={`flex-1 flex flex-col transition-all duration-300 ${
          isCollapsed ? 'md:ml-16' : 'md:ml-64'
        }`}
      >
        {/* Mobile Header with Navigation */}
        <header className="bg-white border-b border-gray-200 md:hidden sticky top-0 z-20">
          <div className="px-3 sm:px-4 py-2 sm:py-3">
            <div className="flex items-center gap-3">
              <MobileNavigation />
              <div className="flex-1 min-w-0">
                <h1 className="text-base sm:text-lg font-bold text-gray-900 truncate">
                  Create Dispatch
                </h1>
                {currentShip && (
                  <p className="text-xs sm:text-sm text-blue-600 truncate">
                    {getShipDisplayName(currentShip)}
                  </p>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Breadcrumbs - Mobile Optimized */}
        <Breadcrumbs />

        <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 pt-3 sm:pt-4 md:pt-6">
          <div className="max-w-7xl mx-auto w-full">
          {/* Ship Selector */}
          <div className="mb-3 sm:mb-4 md:mb-6">
            <ShipSelector showShipNameDropdown={true} />
          </div>

          {/* Dispatch session functionality temporarily disabled */}

          {/* Page Title - Desktop Only (Mobile shows in header) */}
          <div className="mb-3 sm:mb-4 md:mb-6 hidden md:block">
            <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-gray-900 mb-1 sm:mb-2 leading-tight">
              Create New Dispatch Record
              {currentShip && (
                <span className="text-sm sm:text-base md:text-lg font-normal text-blue-600 block mt-1 sm:mt-1.5">
                  for {getShipDisplayName(currentShip)}
                </span>
              )}
            </h1>
            <p className="text-xs sm:text-sm md:text-base text-gray-600 leading-relaxed">
              {currentShip 
                ? `Edit the dispatch template spreadsheet to create a new record for ${getShipDisplayName(currentShip)}`
                : 'Please select a ship above to begin editing the dispatch template'
              }
            </p>
          </div>

          {!currentShip ? (
            <Card className="touch-manipulation">
              <CardContent className="text-center py-4 sm:py-6 md:py-8 px-3 sm:px-4">
                <AlertTriangle className="w-10 h-10 sm:w-12 sm:h-12 text-yellow-500 mx-auto mb-3 sm:mb-4" />
                <p className="text-sm sm:text-base text-gray-600 mb-3 sm:mb-4">Please select a ship above to begin creating dispatch records.</p>
                <p className="text-xs sm:text-sm text-gray-500">Each ship maintains separate templates and data for complete isolation.</p>
              </CardContent>
            </Card>
          ) : isLoadingDispatch ? (
            <Card className="touch-manipulation">
              <CardContent className="flex items-center justify-center py-4 sm:py-6 md:py-8 px-3 sm:px-4">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-blue-600 mx-auto mb-3 sm:mb-4"></div>
                  <p className="text-sm sm:text-base text-gray-600">Loading dispatch template for {getShipDisplayName(currentShip)}...</p>
                </div>
              </CardContent>
            </Card>
          ) : !dispatchTemplate ? (
            <Card className="touch-manipulation">
              <CardContent className="text-center py-4 sm:py-6 md:py-8 px-3 sm:px-4">
                <p className="text-sm sm:text-base text-gray-600 mb-3 sm:mb-4">No dispatch template found for {getShipDisplayName(currentShip)}. Please upload a template first.</p>
                <Button onClick={() => setLocation("/templates/edit")} className="text-sm sm:text-base h-11 sm:h-12 touch-manipulation">
                  Upload Template
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3 sm:space-y-4 md:space-y-6">
              {/* Template Information */}
              <Card className="shadow-sm border-gray-200 hover:shadow-md active:shadow-sm transition-all duration-200 touch-manipulation">
                <CardContent className="p-3 sm:p-4 md:p-6">
                  {/* Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 md:gap-4 mb-3 sm:mb-4">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm sm:text-base md:text-lg font-semibold text-gray-900 truncate">Dispatch Template</h3>
                      <p className="text-xs sm:text-sm text-gray-500 truncate mt-0.5">{dispatchTemplate.originalFilename}</p>
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
                        className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 active:bg-blue-800 font-medium text-sm sm:text-base h-11 sm:h-12 touch-manipulation"
                        size="default"
                      >
                        <Edit className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                        Edit Dispatch Sheet
                      </Button>
                    ) : isEditing ? (
                      <div className="space-y-2 sm:space-y-0 sm:flex sm:gap-2 md:gap-3">
                        <Button 
                          onClick={handleSave}
                          disabled={isLoading}
                          className="w-full sm:flex-1 bg-green-600 hover:bg-green-700 active:bg-green-800 font-medium text-sm sm:text-base h-11 sm:h-12 touch-manipulation"
                          size="default"
                        >
                          <Save className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                          {isLoading ? 'Saving Changes...' : 'Save Changes'}
                        </Button>
                        <Button 
                          onClick={handleCancel}
                          variant="outline"
                          disabled={isLoading}
                          className="w-full sm:flex-1 border-gray-300 hover:bg-gray-50 active:bg-gray-100 text-sm sm:text-base h-11 sm:h-12 touch-manipulation"
                          size="default"
                        >
                          <X className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                          Cancel
                        </Button>
                      </div>
                    ) : showUpdateEOD ? (
                      <div className="space-y-2 sm:space-y-0 sm:grid sm:grid-cols-1 md:grid-cols-3 sm:gap-2 md:gap-3">
                        <Button 
                          onClick={handleUpdateEOD}
                          disabled={updateEODMutation.isPending}
                          className="w-full bg-purple-600 hover:bg-purple-700 active:bg-purple-800 font-medium text-sm sm:text-base h-11 sm:h-12 touch-manipulation"
                          size="default"
                        >
                          <FileText className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                          <span className="hidden md:inline">{updateEODMutation.isPending ? 'Generating...' : 'Generate New EOD Report'}</span>
                          <span className="md:hidden">{updateEODMutation.isPending ? 'Generating...' : 'Generate New EOD'}</span>
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
                          className="w-full bg-blue-50 hover:bg-blue-100 active:bg-blue-200 border-blue-300 text-blue-700 font-medium text-sm sm:text-base h-11 sm:h-12 touch-manipulation"
                          size="default"
                        >
                          <Plus className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                          <span className="hidden md:inline">{successiveDispatchMutation.isPending ? 'Updating...' : 'Update Existing EOD Report'}</span>
                          <span className="md:hidden">{successiveDispatchMutation.isPending ? 'Updating...' : 'Update Existing EOD'}</span>
                        </Button>
                        <Button 
                          onClick={() => {
                            setShowUpdateEOD(false);
                            setSavedFileId(null);
                          }}
                          variant="outline"
                          className="w-full border-gray-300 hover:bg-gray-50 active:bg-gray-100 font-medium text-sm sm:text-base h-11 sm:h-12 touch-manipulation"
                          size="default"
                        >
                          <Edit className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                          Edit Again
                        </Button>
                      </div>
                    ) : null}
                  </div>
                  
                  {/* Warning Notice */}
                  {hasUnsavedChanges && (
                    <div className="mt-2 sm:mt-3 md:mt-4 p-2 sm:p-2.5 md:p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <div className="flex items-center">
                        <AlertTriangle className="w-3 h-3 sm:w-4 sm:h-4 text-amber-600 mr-2 flex-shrink-0" />
                        <p className="text-xs sm:text-sm text-amber-800">You have unsaved changes</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* PAX Template Card - Only show when file is saved */}
              {showUpdateEOD && savedFileId && (
                <Card className="shadow-sm border-gray-200 hover:shadow-md active:shadow-sm transition-all duration-200 touch-manipulation">
                  <CardContent className="p-3 sm:p-4 md:p-6">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 md:gap-4 mb-3 sm:mb-4">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm sm:text-base md:text-lg font-semibold text-gray-900">PAX Template</h3>
                        <p className="text-xs sm:text-sm text-gray-500 mt-0.5">Generate PAX reports from dispatch data</p>
                      </div>
                      
                      {/* Status Badge */}
                      <div className="shrink-0">
                        <span className="inline-flex items-center px-2 py-1 sm:px-2.5 sm:py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                          PAX Ready
                        </span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="space-y-2 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-2 md:gap-3">
                      <Button 
                        onClick={handleUpdatePax}
                        disabled={updatePaxMutation.isPending}
                        className="w-full bg-orange-600 hover:bg-orange-700 active:bg-orange-800 font-medium text-sm sm:text-base h-11 sm:h-12 touch-manipulation"
                        size="default"
                      >
                        <Users className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                        <span className="hidden md:inline">{updatePaxMutation.isPending ? 'Generating...' : 'Generate New PAX Report'}</span>
                        <span className="md:hidden">{updatePaxMutation.isPending ? 'Generating...' : 'Generate New PAX'}</span>
                      </Button>
                      <Button 
                        onClick={handleUpdateExistingPax}
                        disabled={updateExistingPaxMutation.isPending}
                        variant="outline"
                        className="w-full border-orange-300 text-orange-700 hover:bg-orange-50 active:bg-orange-100 font-medium text-sm sm:text-base h-11 sm:h-12 touch-manipulation"
                        size="default"
                      >
                        <FileText className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                        <span className="hidden md:inline">{updateExistingPaxMutation.isPending ? 'Updating...' : 'Update Existing PAX Report'}</span>
                        <span className="md:hidden">{updateExistingPaxMutation.isPending ? 'Updating...' : 'Update Existing PAX'}</span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Spreadsheet Editor */}
              {isEditing && file && (
                <Card>
                  <CardContent className="p-3 sm:p-4 md:p-6">
                    <div className="flex flex-col gap-2 sm:gap-3 md:gap-4 mb-3 sm:mb-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
                        <h3 className="text-sm sm:text-base md:text-lg font-semibold text-gray-900">Edit Dispatch Sheet</h3>
                        
                        {/* View Mode Toggle - Mobile Only */}
                        {isMobile && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSpreadsheetViewMode(spreadsheetViewMode === 'mobile' ? 'landscape' : 'mobile')}
                            className="w-full sm:w-auto h-9 sm:h-10 text-xs sm:text-sm touch-manipulation"
                          >
                            {spreadsheetViewMode === 'mobile' ? (
                              <>
                                <Maximize2 className="w-3 h-3 sm:w-4 sm:h-4 mr-1.5" />
                                View Full Spreadsheet
                              </>
                            ) : (
                              <>
                                <Minimize2 className="w-3 h-3 sm:w-4 sm:h-4 mr-1.5" />
                                Return to Mobile View
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                      
                      {/* Horizontal Scroll Controls - Desktop/Tablet Only */}
                      {!isMobile && (
                        <div className="flex items-center space-x-2">
                          <span className="text-xs sm:text-sm text-gray-600 mr-1 sm:mr-2">
                            Scroll by {getColumnsToScroll()} columns:
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleScrollLeft}
                            disabled={!canScrollLeft}
                            className="flex items-center space-x-1 px-2 sm:px-3 h-9 sm:h-10 touch-manipulation"
                          >
                            <ChevronLeft className="h-3 w-3 sm:h-4 sm:w-4" />
                            <span className="hidden sm:inline">Left</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleScrollRight}
                            disabled={!canScrollRight}
                            className="flex items-center space-x-1 px-2 sm:px-3 h-9 sm:h-10 touch-manipulation"
                          >
                            <span className="hidden sm:inline">Right</span>
                            <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                    
                    {/* Validation Error Counter */}
                    {validationErrors.size > 0 && (
                      <div className="mb-3 sm:mb-4 bg-red-50 border border-red-200 rounded-lg p-2 sm:p-3">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-red-600 flex-shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs sm:text-sm font-medium text-red-800">
                              {validationErrors.size} validation error{validationErrors.size !== 1 ? 's' : ''} found
                            </p>
                            <p className="text-xs text-red-600 mt-0.5 sm:mt-1">
                              {isMobile ? 'Tap cells with red borders to see error messages' : 'Hover over cells with red borders to see specific error messages'}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div className={`border rounded-lg overflow-auto w-full max-w-full ${isMobile && spreadsheetViewMode === 'landscape' ? 'landscape-mode' : ''}`}>
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
                          height={isMobile ? (spreadsheetViewMode === 'landscape' ? 500 : 400) : 600}
                          licenseKey="non-commercial-and-evaluation"
                          beforeChange={(changes) => {
                            normalizeB5Changes(changes || []);
                          }}
                          afterChange={handleDataChange}
                          afterBeginEditing={(row, col) => {
                            // iOS Keyboard Fix: Ensure keyboard appears when editing begins on mobile
                            if (!isMobile) return;
                            
                            // Small delay to ensure Handsontable has created the editor
                            setTimeout(() => {
                              try {
                                const hotInstance = hotTableRef.current?.hotInstance;
                                if (!hotInstance) return;
                                
                                // Get the active editor
                                const activeEditor = hotInstance.getActiveEditor();
                                if (!activeEditor) return;
                                
                                // Handsontable uses TEXTAREA property for text editor
                                const textarea = (activeEditor as any).TEXTAREA as HTMLTextAreaElement | undefined;
                                
                                if (textarea) {
                                  // Force focus on the textarea
                                  textarea.focus();
                                  
                                  // iOS-specific: Dispatch click event to ensure keyboard appears
                                  // iOS Safari requires a user gesture to show keyboard
                                  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
                                  if (isIOS) {
                                    // Create and dispatch a click event to trigger keyboard
                                    const clickEvent = new MouseEvent('click', {
                                      bubbles: true,
                                      cancelable: true,
                                      view: window
                                    });
                                    textarea.dispatchEvent(clickEvent);
                                  }
                                }
                              } catch (error) {
                                // Fail silently - not critical if keyboard trigger fails
                                console.warn('iOS keyboard trigger failed:', error);
                              }
                            }, 50); // 50ms delay to ensure editor is fully initialized
                          }}
                          className="htCenter"
                          colWidths={function(index) {
                            if (index === 0) return isMobile ? 200 : 360;
                            return isMobile ? 80 : 120;
                          }}
                          autoColumnSize={false}
                          preventOverflow="horizontal"
                          fillHandle={!isMobile}
                          mergeCells={lostPaxMergeConfig}
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
                              // iOS Keyboard Fix: Set inputMode for numeric cells
                              if (isMobile) {
                                cellProperties.inputMode = 'numeric';
                              }
                            }
                            
                            // Text-only cells: N11, N13, N15
                            if ((row === 10 || row === 12 || row === 14) && col === 13) {
                              cellProperties.validator = textOnlyValidator;
                              cellProperties.allowInvalid = true;
                              // iOS Keyboard Fix: Set inputMode for text cells
                              if (isMobile) {
                                cellProperties.inputMode = 'text';
                              }
                            }
                            
                            // Date/Time cells: B11, B13, B15 use relaxed time/date validator
                            if (((row === 10 || row === 12 || row === 14) && col === 1)) {
                              cellProperties.validator = dateTimeValidator;
                              cellProperties.allowInvalid = true;
                              // iOS Keyboard Fix: Set inputMode for date/time cells
                              if (isMobile) {
                                cellProperties.inputMode = 'text';
                              }
                            }
                          // B5 uses strict "dd-mmm-yyyy" validator and custom date picker editor
                          if (row === 4 && col === 1) {
                            cellProperties.validator = b5DateValidator;
                            cellProperties.allowInvalid = false;
                            cellProperties.editor = 'b5DateEditor';
                            classNames.push('b5-date-cell');
                            // iOS Keyboard Fix: Set inputMode for date cells
                            if (isMobile) {
                              cellProperties.inputMode = 'text';
                            }
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
                            
                            // iOS Keyboard Fix: Set default inputMode for all editable cells on mobile
                            if (isMobile && !cellProperties.readOnly && !cellProperties.inputMode) {
                              cellProperties.inputMode = 'text';
                            }
                            
                            cellProperties.className = classNames.join(' ');
                            return cellProperties;
                          }}
                          afterValidate={(isValid, value, row, prop) => {
                            const col = typeof prop === 'number' ? prop : 0;
                            const cellKey = `${row},${col}`;
                            const hotInstance = hotTableRef.current?.hotInstance;
                            
                            if (hotInstance) {
                              try {
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
                              } catch (error) {
                                // Instance may be destroyed or unavailable - this is safe to ignore
                                // during cleanup or when component is unmounting
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
              <Card className="touch-manipulation">
                <CardHeader className="px-3 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4">
                  <CardTitle className="flex items-center gap-2 text-sm sm:text-base md:text-lg">
                    <History className="h-4 w-4 sm:h-5 sm:w-5" />
                    Dispatch Sheet Versions
                  </CardTitle>
                  <p className="text-xs sm:text-sm text-gray-600 mt-1">
                    View and manage previously saved dispatch sheet versions
                  </p>
                </CardHeader>
                <CardContent className="px-3 sm:px-6 pb-4 sm:pb-6">
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
                    <div className="space-y-2 sm:space-y-3">
                      {dispatchVersions.slice(0, showAllVersions ? dispatchVersions.length : 3).map((version: any) => (
                        <div key={version.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 p-3 sm:p-4 border rounded-lg hover:border-blue-300 active:border-blue-400 transition-colors touch-manipulation">
                          <div className="flex items-center space-x-3 sm:space-x-4 min-w-0 flex-1">
                            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                              <File className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <h4 className="font-medium text-gray-900 text-sm sm:text-base truncate">
                                {version.originalFilename}
                              </h4>
                              <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                                Version {version.id} • {new Date(version.createdAt).toLocaleDateString()} at{" "}
                                {new Date(version.createdAt).toLocaleTimeString()}
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-end sm:justify-start space-x-2 flex-shrink-0">
                            <Badge variant="secondary" className="text-xs hidden sm:inline-flex">
                              Saved
                            </Badge>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewVersion(version)}
                              disabled={isLoading}
                              className="h-9 sm:h-10 text-xs sm:text-sm touch-manipulation"
                            >
                              <Eye className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-1.5" />
                              <span className="hidden sm:inline">View</span>
                              <span className="sm:hidden">View</span>
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDownloadVersion(version)}
                              className="h-9 sm:h-10 text-xs sm:text-sm touch-manipulation"
                            >
                              <Download className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-1.5" />
                              <span className="hidden sm:inline">Download</span>
                              <span className="sm:hidden">DL</span>
                            </Button>
                          </div>
                        </div>
                      ))}
                      
                      {dispatchVersions.length > 3 && (
                        <div className="text-center pt-2 sm:pt-3 border-t">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowAllVersions(!showAllVersions)}
                            className="text-blue-600 hover:text-blue-800 active:text-blue-900 text-xs sm:text-sm h-9 sm:h-10 touch-manipulation"
                          >
                            {showAllVersions 
                              ? 'Show Less' 
                              : `View More (${dispatchVersions.length - 3} more)`
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
        <DialogContent className="max-w-md w-[calc(100%-2rem)] sm:w-full mx-auto max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader className="px-0 sm:px-0">
            <DialogTitle className="flex items-center text-green-600 text-base sm:text-lg flex-wrap gap-2">
              <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" />
              <span className="break-words">PAX Report Generated!</span>
            </DialogTitle>
          </DialogHeader>
          <div className="py-3 sm:py-4">
            <p className="text-sm sm:text-base text-gray-600 mb-3 sm:mb-4 leading-relaxed break-words">
              Your PAX report has been successfully generated and is ready for download.
            </p>
            <div className="bg-gray-50 rounded-lg p-2 sm:p-3 mb-3 sm:mb-4 overflow-hidden">
              <p className="text-xs sm:text-sm font-medium text-gray-700 mb-1">Generated File:</p>
              <p className="text-xs sm:text-sm text-gray-600 break-all word-break break-words">{paxFileName}</p>
            </div>
            <div className="flex flex-col space-y-2 sm:space-y-3 w-full">
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full">
                <Button 
                  onClick={() => {
                    setShowPaxSuccessModal(false);
                    setLocation("/consolidated-pax-reports");
                  }}
                  className="flex-1 bg-green-600 hover:bg-green-700 active:bg-green-800 h-11 sm:h-12 text-xs sm:text-sm md:text-base touch-manipulation min-w-0"
                >
                  <span className="truncate">View Consolidated PAX</span>
                </Button>
                <Button 
                  onClick={() => {
                    setShowPaxSuccessModal(false);
                    setLocation("/reports");
                  }}
                  variant="outline"
                  className="flex-1 h-11 sm:h-12 text-xs sm:text-sm md:text-base touch-manipulation min-w-0"
                >
                  <span className="truncate">View Reports</span>
                </Button>
              </div>
              <Button 
                onClick={() => setShowPaxSuccessModal(false)}
                variant="outline"
                className="w-full h-11 sm:h-12 text-xs sm:text-sm md:text-base touch-manipulation"
              >
                Continue Here
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

          {/* Update PAX Success Modal */}
          <Dialog open={showUpdatePaxSuccessModal} onOpenChange={setShowUpdatePaxSuccessModal}>
        <DialogContent className="max-w-md w-[calc(100%-2rem)] sm:w-full mx-auto max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader className="px-0 sm:px-0">
            <DialogTitle className="flex items-center text-green-600 text-base sm:text-lg flex-wrap gap-2">
              <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" />
              <span className="break-words">PAX Report Updated!</span>
            </DialogTitle>
          </DialogHeader>
          <div className="py-3 sm:py-4">
            <p className="text-sm sm:text-base text-gray-600 mb-3 sm:mb-4 leading-relaxed break-words">
              Your existing PAX report has been successfully updated with new data.
            </p>
            <div className="bg-gray-50 rounded-lg p-2 sm:p-3 mb-3 sm:mb-4 overflow-hidden">
              <p className="text-xs sm:text-sm font-medium text-gray-700 mb-1">Updated File:</p>
              <p className="text-xs sm:text-sm text-gray-600 break-all word-break break-words">{updatePaxFileName}</p>
            </div>
            <div className="flex flex-col space-y-2 sm:space-y-3 w-full">
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full">
                <Button 
                  onClick={() => {
                    setShowUpdatePaxSuccessModal(false);
                    setLocation("/consolidated-pax-reports");
                  }}
                  className="flex-1 bg-green-600 hover:bg-green-700 active:bg-green-800 h-11 sm:h-12 text-xs sm:text-sm md:text-base touch-manipulation min-w-0"
                >
                  <span className="truncate">View Consolidated PAX</span>
                </Button>
                <Button 
                  onClick={() => {
                    setShowUpdatePaxSuccessModal(false);
                    setLocation("/reports");
                  }}
                  variant="outline"
                  className="flex-1 h-11 sm:h-12 text-xs sm:text-sm md:text-base touch-manipulation min-w-0"
                >
                  <span className="truncate">View Reports</span>
                </Button>
              </div>
              <Button 
                onClick={() => setShowUpdatePaxSuccessModal(false)}
                variant="outline"
                className="w-full h-11 sm:h-12 text-xs sm:text-sm md:text-base touch-manipulation"
              >
                Continue Here
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* EOD Success Modal */}
      <Dialog open={showEodSuccessModal} onOpenChange={setShowEodSuccessModal}>
        <DialogContent className="max-w-md w-[calc(100%-2rem)] sm:w-full mx-auto max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader className="px-0 sm:px-0">
            <DialogTitle className="flex items-center text-purple-600 text-base sm:text-lg flex-wrap gap-2">
              <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" />
              <span className="break-words">EOD Report Updated!</span>
            </DialogTitle>
          </DialogHeader>
          <div className="py-3 sm:py-4">
            <p className="text-sm sm:text-base text-gray-600 mb-3 sm:mb-4 leading-relaxed break-words">
              Your EOD report has been successfully updated with the new dispatch entry.
            </p>
            <div className="bg-gray-50 rounded-lg p-2 sm:p-3 mb-3 sm:mb-4 overflow-hidden">
              <p className="text-xs sm:text-sm font-medium text-gray-700 mb-1">Updated File:</p>
              <p className="text-xs sm:text-sm text-gray-600 break-all word-break break-words">{eodFileName}</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full">
              <Button 
                onClick={() => {
                  setShowEodSuccessModal(false);
                  setLocation("/reports");
                }}
                className="flex-1 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 h-11 sm:h-12 text-xs sm:text-sm md:text-base touch-manipulation min-w-0"
              >
                <span className="truncate">View Reports</span>
              </Button>
              <Button 
                onClick={() => setShowEodSuccessModal(false)}
                variant="outline"
                className="flex-1 h-11 sm:h-12 text-xs sm:text-sm md:text-base touch-manipulation min-w-0"
              >
                <span className="truncate">Continue Here</span>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Validation Error Modal */}
      <Dialog open={showValidationErrorModal} onOpenChange={setShowValidationErrorModal}>
        <DialogContent className="max-w-md w-[calc(100%-2rem)] sm:w-full mx-auto max-h-[90vh] overflow-y-auto p-4 sm:p-6 z-[9999]">
          <DialogHeader className="px-0 sm:px-0">
            <DialogTitle className="flex items-center text-red-600 text-base sm:text-lg flex-wrap gap-2">
              <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" />
              <span className="break-words">Validation Errors</span>
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-600 mt-2">
              Please fix the following validation errors before saving:
            </DialogDescription>
          </DialogHeader>
          <div className="py-3 sm:py-4">
            <div className="bg-red-50 rounded-lg p-2 sm:p-3 mb-3 sm:mb-4 max-h-60 overflow-y-auto overflow-x-hidden">
              {validationErrorsRef.current.size > 0 ? (
              <ul className="list-disc list-inside space-y-1 sm:space-y-1.5 text-xs sm:text-sm text-red-700">
                  {Array.from(validationErrorsRef.current.entries()).map(([cellKey, error]) => {
                    // Convert cell key (e.g., "4,1") to Excel notation (e.g., "B5")
                    const [row, col] = cellKey.split(',').map(Number);
                    const colLetter = String.fromCharCode(65 + col);
                    const excelNotation = `${colLetter}${row + 1}`;
                    return (
                      <li key={cellKey} className="break-words break-all">
                        <span className="font-semibold">{excelNotation}</span>: {error}
                      </li>
                    );
                  })}
              </ul>
              ) : (
                <p className="text-xs sm:text-sm text-red-700">No validation errors found. Please try saving again.</p>
              )}
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              {validationErrorsRef.current.size > 0 && (
                <Button
                  onClick={() => {
                    setShowValidationErrorModal(false);
                    // Scroll to first error cell if possible
                    const firstError = Array.from(validationErrorsRef.current.keys())[0];
                    if (firstError) {
                      const [row, col] = firstError.split(',').map(Number);
                      const hotInstance = hotTableRef.current?.hotInstance;
                      if (hotInstance) {
                        try {
                          hotInstance.selectCell(row, col);
                          hotInstance.scrollViewportTo(row, col);
                        } catch (error) {
                          console.warn('Error scrolling to error cell:', error);
                        }
                      }
                    }
                  }}
                  className="flex-1 h-11 sm:h-12 text-xs sm:text-sm md:text-base touch-manipulation bg-red-600 hover:bg-red-700 active:bg-red-800"
                >
                  Go to First Error
                </Button>
              )}
            <Button 
              onClick={() => setShowValidationErrorModal(false)}
                variant="outline"
                className={`${validationErrorsRef.current.size > 0 ? 'flex-1' : 'w-full'} h-11 sm:h-12 text-xs sm:text-sm md:text-base touch-manipulation`}
            >
                Close
            </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <style>{`
        /* Mobile Landscape Mode */
        .landscape-mode {
          max-height: 70vh;
        }

        @media (max-width: 768px) {
          .landscape-mode .handsontable {
            font-size: 16px;
          }
          
          .landscape-mode .handsontable th,
          .landscape-mode .handsontable td {
            padding: 4px 6px;
            min-height: 32px;
            font-size: 16px !important;
          }
        }

        /* Touch-friendly cell targets on mobile */
        @media (max-width: 768px) {
          .handsontable td {
            min-height: 44px;
            min-width: 60px;
          }
          
          .handsontable th {
            min-height: 44px;
          }
        }

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

        /* Mobile Spreadsheet Optimizations */
        @media (max-width: 768px) {
          /* iOS Keyboard Fix: Minimum 16px font size to prevent zoom and ensure keyboard appears */
          .handsontable {
            font-size: 16px;
          }
          
          .handsontable th,
          .handsontable td {
            padding: 6px 8px;
            min-height: 44px;
            touch-action: manipulation;
            font-size: 16px !important;
          }
          
          .handsontable th {
            font-weight: 600;
            font-size: 16px !important;
          }
          
          /* Ensure editor input has 16px font size for iOS */
          .handsontable .handsontableInput {
            font-size: 16px !important;
            -webkit-appearance: none;
            -webkit-user-select: text;
          }
          
          /* Improve touch targets */
          .handsontable td:active {
            background-color: #e0f2fe !important;
          }
          
          /* Better scrollbar on mobile */
          .handsontable .wtHolder {
            -webkit-overflow-scrolling: touch;
            scroll-behavior: smooth;
          }
        }

        /* Landscape mode optimizations */
        @media (max-width: 768px) and (orientation: landscape) {
          .landscape-mode .handsontable {
            height: 100% !important;
            max-height: 70vh !important;
          }
        }
      `}</style>
          </div>
        </div>
      </div>
    </div>
  );
}
