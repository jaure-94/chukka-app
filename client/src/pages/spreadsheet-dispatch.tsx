import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SidebarNavigation, MobileNavigation } from "@/components/sidebar-navigation";
import { FileText, Download, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSidebar } from "@/contexts/sidebar-context";
import { HotTable } from "@handsontable/react";
import "handsontable/dist/handsontable.full.css";
import * as XLSX from "xlsx";

export default function SpreadsheetDispatchView() {
  const { filename } = useParams<{ filename: string }>();
  const { toast } = useToast();
  const { isCollapsed } = useSidebar();
  const [data, setData] = useState<(string | number)[][]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadSpreadsheet = async () => {
      if (!filename) return;
      
      setIsLoading(true);
      setError(null);
      
      try {
        const response = await fetch(`/api/files/${filename}`);
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
          description: "Failed to load dispatch sheet spreadsheet",
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
      window.open(`/api/files/${filename}`, '_blank');
    }
  };

  const handleBackToReports = () => {
    window.location.href = '/reports';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dispatch sheet...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading File</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={handleBackToReports} className="bg-green-600 hover:bg-green-700">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Reports
          </Button>
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
        {/* Header */}
        <header className="bg-white shadow-sm border-b">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="py-4 flex items-center justify-between">
              <div className="flex items-center">
                <MobileNavigation />
                <div className="ml-4 md:ml-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleBackToReports}
                    className="text-gray-600 hover:text-gray-900 mr-4"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Reports
                  </Button>
                  <h1 className="text-2xl font-bold text-gray-900">Dispatch Sheet View</h1>
                  <p className="text-sm text-gray-600 mt-1">
                    File: {filename}
                  </p>
                </div>
              </div>
              <Button
                onClick={handleDownload}
                className="bg-green-600 hover:bg-green-700"
              >
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileText className="w-5 h-5 mr-2 text-green-600" />
                Dispatch Sheet Spreadsheet
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden border rounded-lg">
                <HotTable
                  data={data}
                  colHeaders={true}
                  rowHeaders={true}
                  readOnly={true}
                  width="100%"
                  height="600px"
                  stretchH="all"
                  autoWrapRow={true}
                  autoWrapCol={true}
                  className="htCore"
                  licenseKey="non-commercial-and-evaluation"
                />
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}