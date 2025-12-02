import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SidebarNavigation, MobileNavigation } from "@/components/sidebar-navigation";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { FileText, Download, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSidebar } from "@/contexts/sidebar-context";
import { useIsMobile } from "@/hooks/use-mobile";
import { HotTable } from "@handsontable/react";
import "handsontable/dist/handsontable.full.css";
import * as XLSX from "xlsx";

export default function SpreadsheetEodView() {
  const { filename } = useParams<{ filename: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isCollapsed } = useSidebar();
  const isMobile = useIsMobile();
  const [data, setData] = useState<(string | number)[][]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [spreadsheetViewMode, setSpreadsheetViewMode] = useState<'mobile' | 'landscape'>('mobile');

  useEffect(() => {
    const loadSpreadsheet = async () => {
      if (!filename) return;
      
      setIsLoading(true);
      setError(null);
      
      try {
        const response = await fetch(`/api/output/${filename}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch file: ${response.statusText}`);
        }
        
        const arrayBuffer = await response.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert to JSON array
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
          header: 1, 
          defval: '',
          blankrows: true,
          raw: false
        });
        
        setData(jsonData as (string | number)[][]);
      } catch (error) {
        console.error('Error loading spreadsheet:', error);
        setError(error instanceof Error ? error.message : 'Failed to load spreadsheet');
        toast({
          title: "Error",
          description: "Failed to load EOD report spreadsheet",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadSpreadsheet();
  }, [filename, toast]);

  const handleDownload = () => {
    if (filename) {
      window.open(`/api/output/${filename}`, '_blank');
    }
  };

  const handleBackToReports = () => {
    setLocation('/reports');
  };

  const getHandsontableHeight = useMemo(() => {
    if (isMobile) {
      return spreadsheetViewMode === 'mobile' ? 400 : 500;
    }
    return 600;
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
    return 120;
  }, [isMobile, spreadsheetViewMode]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex">
        <div className="hidden md:block fixed left-0 top-0 h-full z-10">
          <SidebarNavigation />
        </div>
        <div className={`flex-1 flex items-center justify-center transition-all duration-300 ${
          isCollapsed ? 'md:ml-16' : 'md:ml-64'
        }`}>
          <div className="text-center px-4">
            <div className="animate-spin rounded-full h-8 w-8 sm:h-12 sm:w-12 border-b-2 border-blue-600 mx-auto mb-3 sm:mb-4"></div>
            <p className="text-sm sm:text-base text-gray-600">Loading EOD report...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex">
        <div className="hidden md:block fixed left-0 top-0 h-full z-10">
          <SidebarNavigation />
        </div>
        <div className={`flex-1 flex items-center justify-center transition-all duration-300 ${
          isCollapsed ? 'md:ml-16' : 'md:ml-64'
        }`}>
          <div className="text-center px-4">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
              <FileText className="w-6 w-6 sm:w-8 sm:h-8 text-red-600" />
            </div>
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">Error Loading File</h2>
            <p className="text-sm sm:text-base text-gray-600 mb-4">{error}</p>
            <Button 
              onClick={handleBackToReports} 
              className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 h-10 sm:h-11 text-sm sm:text-base touch-manipulation"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Reports
            </Button>
          </div>
        </div>
      </div>
    );
  }

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
            <div className="flex items-center gap-2 sm:gap-3">
              <MobileNavigation />
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBackToReports}
                className="text-gray-600 hover:text-gray-900 active:text-gray-700 h-9 sm:h-10 w-9 sm:w-10 p-0 touch-manipulation flex-shrink-0"
              >
                <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
              </Button>
              <div className="flex-1 min-w-0">
                <h1 className="text-base sm:text-lg font-bold text-gray-900 truncate">
                  EOD Report
                </h1>
                <p className="text-xs sm:text-sm text-gray-500 truncate">
                  {filename}
                </p>
              </div>
              <Button
                onClick={handleDownload}
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white h-9 sm:h-10 text-xs sm:text-sm touch-manipulation flex-shrink-0"
              >
                <Download className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline ml-1.5">Download</span>
              </Button>
            </div>
          </div>
        </header>

        {/* Breadcrumbs - Mobile Optimized */}
        <Breadcrumbs />

        <div className="flex-1 overflow-y-auto">
        {/* Header - Desktop Only */}
        <header className="bg-white shadow-sm border-b hidden md:block">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="py-4 flex items-center justify-between">
              <div className="flex items-center">
                <MobileNavigation />
                <div className="ml-4 md:ml-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleBackToReports}
                    className="text-gray-600 hover:text-gray-900 mr-4 h-9 sm:h-10 text-sm touch-manipulation"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Reports
                  </Button>
                  <h1 className="text-xl sm:text-2xl font-bold text-gray-900">EOD Report View</h1>
                  <p className="text-sm text-gray-600 mt-1">
                    File: {filename}
                  </p>
                </div>
              </div>
              <Button
                onClick={handleDownload}
                className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 h-10 sm:h-11 text-sm sm:text-base touch-manipulation"
              >
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-3 sm:p-4 md:p-6">
          <Card className="touch-manipulation">
            <CardHeader className="px-3 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                <CardTitle className="flex items-center text-base sm:text-lg">
                  <FileText className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-blue-600 flex-shrink-0" />
                  <span>EOD Report Spreadsheet</span>
                </CardTitle>

                {/* Spreadsheet View Mode Toggle - Mobile Only */}
                {isMobile && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSpreadsheetViewMode(prev => prev === 'mobile' ? 'landscape' : 'mobile')}
                    className="flex items-center space-x-1 px-2 sm:px-3 h-9 sm:h-10 text-xs sm:text-sm touch-manipulation w-full sm:w-auto"
                  >
                    {spreadsheetViewMode === 'mobile' ? (
                      <>
                        <span>View Full</span>
                      </>
                    ) : (
                      <>
                        <span>Mobile View</span>
                      </>
                    )}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="px-3 sm:px-4 md:px-6 pb-4 sm:pb-6">
              <div className="overflow-auto border rounded-lg">
                <HotTable
                  data={data}
                  colHeaders={true}
                  rowHeaders={true}
                  readOnly={true}
                  width="100%"
                  height={getHandsontableHeight}
                  stretchH="all"
                  autoWrapRow={true}
                  autoWrapCol={true}
                  className="htCore"
                  licenseKey="non-commercial-and-evaluation"
                  colWidths={getColWidths}
                  contextMenu={false}
                  manualRowResize={false}
                  manualColumnResize={false}
                  viewportRowRenderingOffset={isMobile ? 10 : 50}
                  viewportColumnRenderingOffset={isMobile ? 3 : 10}
                  renderAllRows={false}
                  renderAllColumns={false}
                  cells={function(row, col) {
                    const cellProperties: any = {};
                    if (isMobile) {
                      cellProperties.className = 'htMobileCell';
                      if (spreadsheetViewMode === 'landscape') {
                        cellProperties.className += ' htLandscapeCell';
                      }
                    }
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
            </CardContent>
          </Card>
        </main>
        </div>
      </div>

      <style>{`
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