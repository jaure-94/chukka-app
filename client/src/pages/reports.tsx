import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SidebarNavigation, MobileNavigation } from "@/components/sidebar-navigation";
import { BarChart3, Download, FileText, Calendar, Users, File, TrendingUp } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useSidebar } from "@/contexts/sidebar-context";

interface ProcessingJob {
  id: number;
  status: string;
  templateType: string;
  outputPath?: string;
  dropboxUrl?: string;
  createdAt: string;
}



interface GeneratedReport {
  id: number;
  dispatchFilePath: string;
  eodFilePath?: string | null;
  recordCount: number;
  createdAt: string;
}

export default function Reports() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { isCollapsed } = useSidebar();

  // Fetch recent generated reports
  const { data: recentJobs = [], isLoading: isLoadingJobs } = useQuery<ProcessingJob[]>({
    queryKey: ["/api/processing-jobs"],
  });

  // Fetch generated reports (this includes single record reports)
  const { data: generatedReports = [], isLoading: isLoadingReports } = useQuery<GeneratedReport[]>({
    queryKey: ["/api/generated-reports"],
  });



  // Fetch output files
  const { data: outputFiles = [], isLoading: isLoadingFiles } = useQuery({
    queryKey: ["/api/output-files"],
  });

  // Fetch dispatch versions (to get most recent dispatch sheet)
  const { data: dispatchVersions = [], isLoading: isLoadingVersions } = useQuery({
    queryKey: ["/api/dispatch-versions"],
  });



  const handleDownloadReport = (reportId: number, type: 'dispatch' | 'eod') => {
    window.open(`/api/download-report/${reportId}/${type}`, '_blank');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
      case "processing":
        return <Badge className="bg-blue-100 text-blue-800">Processing</Badge>;
      case "failed":
        return <Badge className="bg-red-100 text-red-800">Failed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

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
            <div className="py-6 flex items-center justify-between">
              <div className="flex items-center">
                <MobileNavigation />
                <div className="ml-4 md:ml-0">
                  <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
                  <p className="mt-2 text-gray-600">
                    Generate and manage your dispatch and EOD reports
                  </p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">

          {/* Latest Reports Quick Access */}
          <Card className="mb-8 bg-gradient-to-r from-blue-50 to-green-50 border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center text-blue-900">
                <File className="w-5 h-5 mr-2" />
                Latest Reports - Quick Access
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Most Recent EOD Report */}
                <div className="bg-white rounded-lg p-6 border border-blue-200 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900 flex items-center">
                      <FileText className="w-4 h-4 mr-2 text-blue-600" />
                      Latest EOD Report
                    </h3>
                    {outputFiles.find(file => file.filename.startsWith('eod_')) && (
                      <Badge className="bg-green-100 text-green-800">Available</Badge>
                    )}
                  </div>
                  
                  {(() => {
                    const latestEOD = outputFiles
                      .filter(file => file.filename.startsWith('eod_'))
                      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
                    
                    return latestEOD ? (
                      <div>
                        <div className="text-sm text-gray-600 mb-3">
                          <div className="flex items-center mb-1">
                            <Calendar className="w-3 h-3 mr-1" />
                            Generated: {new Date(latestEOD.createdAt).toLocaleDateString('en-US', {
                              month: 'long',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </div>
                          <div className="text-xs text-gray-500 ml-4">
                            {new Date(latestEOD.createdAt).toLocaleTimeString('en-US', {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit'
                            })}
                          </div>
                          <div className="text-xs text-gray-500 ml-4 mt-1">
                            File: {latestEOD.filename}
                          </div>
                        </div>
                        <Button 
                          size="sm" 
                          className="w-full bg-blue-600 hover:bg-blue-700"
                          onClick={() => window.open(`/api/output/${latestEOD.filename}`, '_blank')}
                        >
                          <Download className="w-3 h-3 mr-2" />
                          Download EOD Report
                        </Button>
                      </div>
                    ) : (
                      <div className="text-center py-4">
                        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-2">
                          <FileText className="w-6 h-6 text-gray-400" />
                        </div>
                        <p className="text-gray-500 text-sm">No EOD reports generated yet</p>
                      </div>
                    );
                  })()}
                </div>

                {/* Most Recent Dispatch Sheet */}
                <div className="bg-white rounded-lg p-6 border border-green-200 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900 flex items-center">
                      <FileText className="w-4 h-4 mr-2 text-green-600" />
                      Latest Dispatch Sheet
                    </h3>
                    {dispatchVersions.length > 0 && (
                      <Badge className="bg-blue-100 text-blue-800">Available</Badge>
                    )}
                  </div>
                  
                  {(() => {
                    const latestDispatch = dispatchVersions[0]; // Already sorted by most recent
                    
                    return latestDispatch ? (
                      <div>
                        <div className="text-sm text-gray-600 mb-3">
                          <div className="flex items-center mb-1">
                            <Calendar className="w-3 h-3 mr-1" />
                            Saved: {new Date(latestDispatch.createdAt).toLocaleDateString('en-US', {
                              month: 'long',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </div>
                          <div className="text-xs text-gray-500 ml-4">
                            {new Date(latestDispatch.createdAt).toLocaleTimeString('en-US', {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit'
                            })}
                          </div>
                          <div className="text-xs text-gray-500 ml-4 mt-1">
                            File: {latestDispatch.originalFilename}
                          </div>
                        </div>
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="w-full border-green-600 text-green-600 hover:bg-green-50"
                          onClick={() => window.open(`/api/files/${latestDispatch.filename}`, '_blank')}
                        >
                          <Download className="w-3 h-3 mr-2" />
                          Download Dispatch
                        </Button>
                      </div>
                    ) : (
                      <div className="text-center py-4">
                        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-2">
                          <FileText className="w-6 h-6 text-gray-400" />
                        </div>
                        <p className="text-gray-500 text-sm">No dispatch sheets saved yet</p>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Generated Reports Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <BarChart3 className="w-5 h-5 mr-2 text-green-600" />
                Generated Reports
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingReports ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
                  <p className="text-gray-500 mt-2">Loading reports...</p>
                </div>
              ) : generatedReports.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FileText className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-gray-500 mb-4">No reports generated yet</p>
                  <p className="text-sm text-gray-400">
                    Create dispatch records to generate reports automatically
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {generatedReports.slice(0, 10).map((report) => (
                    <div
                      key={report.id}
                      className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                          <FileText className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900">
                            {report.recordCount === 1 ? "Single Record Report" : `Batch Report (${report.recordCount} records)`}
                          </h4>
                          <div className="flex items-center text-sm text-gray-500 mt-1">
                            <Calendar className="w-3 h-3 mr-1" />
                            {new Date(report.createdAt).toLocaleDateString()} at{" "}
                            {new Date(report.createdAt).toLocaleTimeString()}
                          </div>
                          <div className="flex items-center text-xs text-gray-400 mt-1">
                            <Users className="w-3 h-3 mr-1" />
                            {report.recordCount} record{report.recordCount !== 1 ? 's' : ''}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Badge className="bg-green-100 text-green-800">Ready</Badge>
                        
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleDownloadReport(report.id, 'dispatch')}
                        >
                          <Download className="w-3 h-3 mr-1" />
                          Dispatch
                        </Button>
                        
                        {report.eodFilePath && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleDownloadReport(report.id, 'eod')}
                          >
                            <Download className="w-3 h-3 mr-1" />
                            EOD
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Generated Files */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center">
                <File className="w-5 h-5 mr-2 text-purple-600" />
                Generated Files
              </CardTitle>
              <p className="text-sm text-gray-600">
                Download your generated EOD and dispatch reports
              </p>
            </CardHeader>
            <CardContent>
              {isLoadingFiles ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
                  <p className="text-gray-500 mt-2">Loading files...</p>
                </div>
              ) : outputFiles.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <File className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-gray-500 mb-4">No generated files yet</p>
                  <p className="text-sm text-gray-400">
                    Edit and save dispatch sheets to generate files
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {outputFiles.map((file: any) => (
                    <div
                      key={file.filename}
                      className="border border-gray-200 rounded-lg p-4 hover:border-purple-300 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <div className={`w-2 h-2 rounded-full ${
                              file.type === 'EOD Report' ? 'bg-green-500' : 'bg-blue-500'
                            }`}></div>
                            <Badge 
                              variant={file.type === 'EOD Report' ? 'default' : 'secondary'}
                              className="text-xs"
                            >
                              {file.type}
                            </Badge>
                          </div>
                          <h4 className="font-medium text-gray-900 text-sm truncate">
                            {file.filename}
                          </h4>
                        </div>
                      </div>
                      
                      <div className="space-y-2 mb-4">
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>Size:</span>
                          <span>{(file.size / 1024).toFixed(1)} KB</span>
                        </div>
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>Created:</span>
                          <span>{new Date(file.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      
                      <Button
                        onClick={() => window.open(file.downloadUrl, '_blank')}
                        className="w-full"
                        size="sm"
                        variant="outline"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Report Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <FileText className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total Reports</p>
                    <p className="text-2xl font-bold text-gray-900">{generatedReports.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-4 h-4 text-green-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total Records</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {generatedReports.reduce((total, report) => total + report.recordCount, 0)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Users className="w-4 h-4 text-purple-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">This Month</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {recentJobs.filter(job => {
                        const jobDate = new Date(job.createdAt);
                        const now = new Date();
                        return jobDate.getMonth() === now.getMonth() && 
                               jobDate.getFullYear() === now.getFullYear();
                      }).length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}