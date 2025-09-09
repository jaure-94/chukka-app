import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, FileText, Calendar, Users, Ship, Globe, Clock, Download } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow, format } from 'date-fns';

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
  // Fetch the latest consolidated PAX report
  const { data: latestReport, isLoading, error } = useQuery<ConsolidatedPaxReport | null>({
    queryKey: ["/api/consolidated-pax-reports/latest"],
    queryFn: async () => {
      const response = await fetch("/api/consolidated-pax-reports");
      if (!response.ok) throw new Error('Failed to fetch reports');
      const reports: ConsolidatedPaxReport[] = await response.json();
      return reports.length > 0 ? reports[0] : null; // First one is latest due to sorting
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const handleViewAllReports = () => {
    window.location.href = '/consolidated-pax-reports';
  };

  const handleDownloadLatest = () => {
    if (latestReport) {
      const downloadUrl = `/api/consolidated-pax/download/${encodeURIComponent(latestReport.filename)}`;
      window.open(downloadUrl, '_blank');
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
            onClick={handleViewAllReports}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            <FileText className="h-4 w-4 mr-2" />
            Generate First Report
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
        <div className="grid grid-cols-2 gap-2 pt-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleDownloadLatest}
            className="border-blue-300 text-blue-700 hover:bg-blue-50"
          >
            <Download className="h-4 w-4 mr-1" />
            Download
          </Button>
          <Button 
            size="sm"
            onClick={handleViewAllReports}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <FileText className="h-4 w-4 mr-1" />
            View All
          </Button>
        </div>

        {/* Last Generated Time */}
        <div className="text-xs text-blue-600 text-center pt-2 border-t">
          Generated on {format(new Date(latestReport.createdAt), 'MMM dd, yyyy')} at {format(new Date(latestReport.createdAt), 'HH:mm')}
        </div>
      </CardContent>
    </Card>
  );
}