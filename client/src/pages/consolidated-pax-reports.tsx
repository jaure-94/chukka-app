import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SidebarNavigation, MobileNavigation } from "@/components/sidebar-navigation";
import { ShareReportsModal } from "@/components/sharing/ShareReportsModal";
import { AlertCircle, Download, FileText, Calendar, Users, File, TrendingUp, Share, RefreshCw, Ship, Globe } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useSidebar } from "@/contexts/sidebar-context";
import { formatDistanceToNow } from 'date-fns';

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

export default function ConsolidatedPaxReports() {
  const [location] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isGenerating, setIsGenerating] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<ConsolidatedPaxReport | null>(null);

  const { isCollapsed } = useSidebar();

  // Fetch consolidated PAX reports
  const { data: reports = [], isLoading, error } = useQuery<ConsolidatedPaxReport[]>({
    queryKey: ["/api/consolidated-pax-reports"],
    queryFn: () => fetch("/api/consolidated-pax-reports").then(res => res.json()),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Generate new consolidated PAX report
  const handleGenerateReport = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch("/api/consolidated-pax/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const result = await response.json();

      if (response.ok && result.success) {
        toast({
          title: "Success",
          description: "Consolidated PAX report generated successfully!",
        });
        queryClient.invalidateQueries({ queryKey: ["/api/consolidated-pax-reports"] });
      } else {
        throw new Error(result.message || "Failed to generate report");
      }
    } catch (error) {
      console.error("Generation failed:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate consolidated PAX report",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Download report
  const handleDownload = (report: ConsolidatedPaxReport) => {
    const downloadUrl = `/api/consolidated-pax/download/${encodeURIComponent(report.filename)}`;
    window.open(downloadUrl, '_blank');
  };

  // Share report
  const handleShare = (report: ConsolidatedPaxReport) => {
    setSelectedReport(report);
    setShareModalOpen(true);
  };

  const getShipDisplayNames = (ships: string[]) => {
    return ships.map(ship => {
      switch (ship) {
        case 'ship-a': return 'Ship A';
        case 'ship-b': return 'Ship B';
        case 'ship-c': return 'Ship C';
        default: return ship.toUpperCase();
      }
    }).join(', ');
  };

  const getStatusBadgeVariant = (ships: string[]) => {
    if (ships.length === 3) return "default"; // All ships
    if (ships.length === 2) return "secondary"; // Two ships
    return "outline"; // One ship
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <SidebarNavigation />
      <MobileNavigation />
      
      <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${isCollapsed ? 'ml-16' : 'ml-64'}`}>
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <Globe className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Consolidated PAX Reports
                </h1>
                <p className="text-gray-500 dark:text-gray-400">
                  Unified passenger reports from all ships
                </p>
              </div>
            </div>
            
            <Button
              onClick={handleGenerateReport}
              disabled={isGenerating}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Generate New Report
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-blue-100">Total Reports</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{reports.length}</div>
                <div className="text-xs text-blue-100">Consolidated reports generated</div>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-green-100">Total Records</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {reports.reduce((sum, report) => sum + report.totalRecordCount, 0)}
                </div>
                <div className="text-xs text-green-100">Passenger records processed</div>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-purple-100">Active Ships</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {reports.length > 0 ? 
                    Math.max(...reports.map(r => r.contributingShips.length)) : 0}
                </div>
                <div className="text-xs text-purple-100">Maximum ships in report</div>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-r from-orange-500 to-orange-600 text-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-orange-100">Last Updated</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {reports.length > 0 ? 
                    formatDistanceToNow(new Date(reports[0].updatedAt), { addSuffix: true }) : 'Never'}
                </div>
                <div className="text-xs text-orange-100">Most recent report</div>
              </CardContent>
            </Card>
          </div>

          {/* Reports List */}
          <Card className="bg-white dark:bg-gray-800">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center text-gray-900 dark:text-white">
                  <FileText className="h-5 w-5 mr-2" />
                  Consolidated PAX Reports
                </CardTitle>
                <Badge variant="outline" className="text-xs">
                  {reports.length} report{reports.length !== 1 ? 's' : ''} available
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
                  <span className="ml-2 text-gray-600 dark:text-gray-400">Loading reports...</span>
                </div>
              ) : error ? (
                <div className="flex items-center justify-center py-12 text-red-600">
                  <AlertCircle className="h-8 w-8 mr-2" />
                  Failed to load reports
                </div>
              ) : reports.length === 0 ? (
                <div className="text-center py-12">
                  <Ship className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    No consolidated reports yet
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-6">
                    Generate your first consolidated PAX report to see all ships' passenger data in one place.
                  </p>
                  <Button
                    onClick={handleGenerateReport}
                    disabled={isGenerating}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <TrendingUp className="h-4 w-4 mr-2" />
                    Generate First Report
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {reports.map((report) => (
                    <div
                      key={report.id}
                      className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <div className="flex items-center space-x-4">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                          <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-white">
                            {report.filename}
                          </h4>
                          <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
                            <span className="flex items-center">
                              <Calendar className="h-4 w-4 mr-1" />
                              {new Date(report.createdAt).toLocaleDateString()}
                            </span>
                            <span className="flex items-center">
                              <Users className="h-4 w-4 mr-1" />
                              {report.totalRecordCount} records
                            </span>
                            <span className="flex items-center">
                              <Ship className="h-4 w-4 mr-1" />
                              Last updated by {report.lastUpdatedByShip.toUpperCase()}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-3">
                        <Badge 
                          variant={getStatusBadgeVariant(report.contributingShips)}
                          className="text-xs"
                        >
                          {getShipDisplayNames(report.contributingShips)}
                        </Badge>
                        
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleShare(report)}
                            className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                          >
                            <Share className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleDownload(report)}
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            <Download className="h-4 w-4 mr-1" />
                            Download
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Share Modal */}
      {selectedReport && (
        <ShareReportsModal
          isOpen={shareModalOpen}
          onClose={() => {
            setShareModalOpen(false);
            setSelectedReport(null);
          }}
          shipId="consolidated"
          availableReports={{
            'consolidated-pax': {
              filename: selectedReport.filename,
              path: selectedReport.filePath
            }
          }}
          preSelectedReports={['consolidated-pax']}
        />
      )}
    </div>
  );
}