import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertCircle, FileText, Calendar, Users, Ship, Globe, Clock, Download, Share, Eye } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow, format } from 'date-fns';
import { ShareReportsModal } from "@/components/sharing/ShareReportsModal";
import { HotTable } from "@handsontable/react";
import type { HotTableClass } from "@handsontable/react";
import { registerAllModules } from "handsontable/registry";
import "handsontable/dist/handsontable.full.min.css";
import * as XLSX from "xlsx";

// Register Handsontable modules
registerAllModules();

interface ConsolidatedPaxReport {
  id: number;
  filename: string;
  filePath: string;
  contributingShips: string[];
  totalRecordCount: number;
  lastUpdatedByShip: string;
  createdAt: string;
  updatedAt: string;
}

export function LatestConsolidatedPaxCard() {
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [viewData, setViewData] = useState<any[][]>([]);
  const [viewHeaders, setViewHeaders] = useState<string[]>([]);
  const [isLoadingView, setIsLoadingView] = useState(false);
  const hotTableRef = useRef<HotTableClass>(null);

  // Fetch the latest consolidated PAX report
  const { data: latestReport, isLoading, error } = useQuery<ConsolidatedPaxReport | null>({
    queryKey: ["/api/consolidated-pax-reports/latest"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const handleShare = () => {
    setShareModalOpen(true);
  };

  const handleDownloadLatest = () => {
    if (latestReport) {
      const downloadUrl = `/api/consolidated-pax/download/${encodeURIComponent(latestReport.filename)}`;
      window.open(downloadUrl, '_blank');
    }
  };

  const handleViewLatest = async () => {
    if (!latestReport) return;
    
    setIsLoadingView(true);
    try {
      const response = await fetch(`/api/consolidated-pax/view/${encodeURIComponent(latestReport.filename)}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch consolidated PAX data for viewing');
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      
      // Convert to array format
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
      
      if (jsonData.length > 0) {
        const headers = (jsonData[0] as string[]) || [];
        const data = jsonData.slice(1);
        
        setViewHeaders(headers);
        setViewData(data as any[][]);
        setViewModalOpen(true);
      }
    } catch (error) {
      console.error('Error loading consolidated PAX for view:', error);
    } finally {
      setIsLoadingView(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-blue-900">
            <Globe className="h-5 w-5 mr-2" />
            Latest Consolidated PAX Report
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-blue-200 rounded w-3/4"></div>
            <div className="h-3 bg-blue-200 rounded w-1/2"></div>
            <div className="h-8 bg-blue-200 rounded w-full"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !latestReport) {
    return (
      <Card className="border border-yellow-200 bg-gradient-to-br from-yellow-50 to-orange-50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-yellow-900">
            <Globe className="h-5 w-5 mr-2" />
            Latest Consolidated PAX Report
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center text-yellow-700">
            <AlertCircle className="h-4 w-4 mr-2" />
            <span className="text-sm">No consolidated reports available yet</span>
          </div>
          <Button 
            onClick={handleShare}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            <Share className="h-4 w-4 mr-2" />
            Share Reports
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-blue-900">
          <div className="flex items-center">
            <Globe className="h-5 w-5 mr-2" />
            Latest Consolidated PAX Report
          </div>
          <Badge variant="secondary" className="bg-blue-100 text-blue-800">
            Latest
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Report Summary */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-blue-900">Report File:</span>
            <span className="text-sm text-blue-700 font-mono bg-blue-100 px-2 py-1 rounded">
              {latestReport.filename}
            </span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-blue-900">Total Records:</span>
            <div className="flex items-center text-blue-700">
              <Users className="h-4 w-4 mr-1" />
              <span className="font-semibold">{latestReport.totalRecordCount}</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-blue-900">Contributing Ships:</span>
            <div className="flex items-center space-x-1">
              <Ship className="h-4 w-4 text-blue-600" />
              <span className="text-sm text-blue-700 font-medium">
                {latestReport.contributingShips.length} ships
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-blue-900">Last Updated:</span>
            <div className="flex items-center text-blue-700">
              <Clock className="h-4 w-4 mr-1" />
              <span className="text-xs">
                {formatDistanceToNow(new Date(latestReport.updatedAt))} ago
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-blue-900">Updated By:</span>
            <Badge variant="outline" className="border-blue-300 text-blue-700">
              Ship {latestReport.lastUpdatedByShip.toUpperCase()}
            </Badge>
          </div>
        </div>

        {/* Contributing Ships List */}
        <div className="border-t pt-3">
          <span className="text-sm font-medium text-blue-900 mb-2 block">Ships Included:</span>
          <div className="flex flex-wrap gap-1">
            {latestReport.contributingShips.map((ship) => (
              <Badge 
                key={ship} 
                variant="secondary" 
                className="bg-blue-100 text-blue-800 text-xs"
              >
                {ship.toUpperCase()}
              </Badge>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-3 gap-2 pt-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleViewLatest}
            disabled={isLoadingView}
            className="border-blue-300 text-blue-700 hover:bg-blue-50"
            data-testid="button-view-latest-pax"
          >
            <Eye className="h-4 w-4 mr-1" />
            {isLoadingView ? 'Loading...' : 'View'}
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleDownloadLatest}
            className="border-blue-300 text-blue-700 hover:bg-blue-50"
            data-testid="button-download-latest-pax"
          >
            <Download className="h-4 w-4 mr-1" />
            Download
          </Button>
          <Button 
            size="sm"
            onClick={handleShare}
            className="bg-blue-600 hover:bg-blue-700"
            data-testid="button-share-latest-pax"
          >
            <Share className="h-4 w-4 mr-1" />
            Share
          </Button>
        </div>

        {/* Last Generated Time */}
        <div className="text-xs text-blue-600 text-center pt-2 border-t">
          Generated on {format(new Date(latestReport.createdAt), 'MMM dd, yyyy')} at {format(new Date(latestReport.createdAt), 'HH:mm')}
        </div>
      </CardContent>

      {/* View Modal */}
      <Dialog open={viewModalOpen} onOpenChange={setViewModalOpen}>
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center text-blue-900">
              <FileText className="w-5 h-5 mr-2" />
              View Consolidated PAX Report
            </DialogTitle>
          </DialogHeader>
          <div className="p-4 overflow-hidden">
            {latestReport && (
              <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-blue-900">Report: {latestReport.filename}</span>
                  <span className="text-blue-700">{latestReport.totalRecordCount} records from {latestReport.contributingShips.length} ships</span>
                </div>
              </div>
            )}
            
            {viewData.length > 0 && (
              <div className="border rounded-lg overflow-auto" style={{ height: '60vh' }}>
                <HotTable
                  ref={hotTableRef}
                  data={viewData}
                  colHeaders={viewHeaders.length > 0 ? viewHeaders : true}
                  rowHeaders={true}
                  readOnly={true}
                  contextMenu={false}
                  manualRowResize={true}
                  manualColumnResize={true}
                  stretchH="none"
                  width="100%"
                  height="100%"
                  licenseKey="non-commercial-and-evaluation"
                  className="htCenter"
                  wordWrap={false}
                  autoWrapRow={false}
                  autoWrapCol={false}
                  data-testid="consolidated-pax-view-table"
                />
              </div>
            )}
            
            <div className="flex justify-end mt-4">
              <Button 
                onClick={() => setViewModalOpen(false)}
                variant="outline"
                data-testid="button-close-view-modal"
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Share Modal */}
      {latestReport && (
        <ShareReportsModal
          isOpen={shareModalOpen}
          onClose={() => setShareModalOpen(false)}
          shipId="consolidated"
          availableReports={{
            'consolidated-pax': {
              filename: latestReport.filename,
              path: latestReport.filePath
            }
          }}
          preSelectedReports={['consolidated-pax']}
        />
      )}
    </Card>
  );
}