import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SidebarNavigation, MobileNavigation } from "@/components/sidebar-navigation";
import { BarChart3, Download, FileText, Calendar, Users, TrendingUp, File } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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

interface TemplateFile {
  id: number;
  filename: string;
  originalFilename: string;
  filePath: string;
  isActive: boolean;
  createdAt: string;
}

export default function Reports() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isGenerating, setIsGenerating] = useState(false);
  const { isCollapsed } = useSidebar();

  // Fetch recent generated reports
  const { data: recentJobs = [], isLoading: isLoadingJobs } = useQuery<ProcessingJob[]>({
    queryKey: ["/api/processing-jobs"],
  });

  // Fetch template files
  const { data: dispatchTemplate } = useQuery<TemplateFile>({
    queryKey: ["/api/dispatch-templates"],
  });

  const { data: eodTemplate } = useQuery<TemplateFile>({
    queryKey: ["/api/eod-templates"],
  });

  // Generate report mutation
  const generateReportMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/generate-reports", {});
      return response.json();
    },
    onMutate: () => {
      setIsGenerating(true);
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: "Report generation started successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/processing-jobs"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: "Failed to generate report",
        variant: "destructive",
      });
      console.error("Generate report error:", error);
    },
    onSettled: () => {
      setIsGenerating(false);
    },
  });

  const handleGenerateReport = () => {
    generateReportMutation.mutate();
  };

  const handleDownloadTemplate = (type: 'dispatch' | 'eod') => {
    window.open(`/api/templates/${type}/download`, '_blank');
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
          {/* Template Files Section */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileText className="w-5 h-5 mr-2 text-green-600" />
                Stored Template Files
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Dispatch Template */}
                <div className="border rounded-lg p-6 bg-gradient-to-br from-blue-50 to-indigo-50">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">Dispatch Template</h3>
                      <p className="text-sm text-gray-600">Main dispatch Excel file</p>
                    </div>
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <File className="w-5 h-5 text-blue-600" />
                    </div>
                  </div>
                  
                  {dispatchTemplate && dispatchTemplate.id ? (
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm font-medium text-gray-700">File Name:</p>
                        <p className="text-sm text-gray-900 truncate">{dispatchTemplate.originalFilename}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-700">Uploaded:</p>
                        <p className="text-sm text-gray-900">{new Date(dispatchTemplate.createdAt).toLocaleDateString()}</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadTemplate('dispatch')}
                        className="w-full mt-3"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download Template
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-sm text-gray-500 mb-3">No dispatch template uploaded</p>
                      <Badge variant="secondary">Not Available</Badge>
                    </div>
                  )}
                </div>

                {/* EOD Template */}
                <div className="border rounded-lg p-6 bg-gradient-to-br from-green-50 to-emerald-50">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">EOD Template</h3>
                      <p className="text-sm text-gray-600">End of Day report template</p>
                    </div>
                    <div className="p-2 bg-green-100 rounded-lg">
                      <Calendar className="w-5 h-5 text-green-600" />
                    </div>
                  </div>
                  
                  {eodTemplate && eodTemplate.id ? (
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm font-medium text-gray-700">File Name:</p>
                        <p className="text-sm text-gray-900 truncate">{eodTemplate.originalFilename}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-700">Uploaded:</p>
                        <p className="text-sm text-gray-900">{new Date(eodTemplate.createdAt).toLocaleDateString()}</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadTemplate('eod')}
                        className="w-full mt-3"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download Template
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-sm text-gray-500 mb-3">No EOD template uploaded</p>
                      <Badge variant="secondary">Not Available</Badge>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Generate Report Section */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center">
                <TrendingUp className="w-5 h-5 mr-2 text-blue-600" />
                Generate New Report
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-4 sm:space-y-0">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Create EOD Report</h3>
                  <p className="text-gray-600 text-sm max-w-2xl">
                    Generate a comprehensive End of Day report using your stored templates and dispatch records. 
                    The report will include all active dispatch data with tour summaries and guest counts.
                  </p>
                </div>
                <Button 
                  onClick={handleGenerateReport}
                  disabled={isGenerating}
                  className="bg-blue-600 hover:bg-blue-700 min-w-[200px]"
                >
                  {isGenerating ? "Generating..." : "Generate Report"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Recent Reports Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <BarChart3 className="w-5 h-5 mr-2 text-green-600" />
                Recent Reports
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingJobs ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="text-gray-500 mt-2">Loading reports...</p>
                </div>
              ) : recentJobs.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FileText className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-gray-500 mb-4">No reports generated yet</p>
                  <p className="text-sm text-gray-400">
                    Generate your first report to see it listed here
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentJobs.slice(0, 10).map((job) => (
                    <div
                      key={job.id}
                      className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <FileText className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900">
                            {job.templateType || "EOD Report"}
                          </h4>
                          <div className="flex items-center text-sm text-gray-500 mt-1">
                            <Calendar className="w-3 h-3 mr-1" />
                            {new Date(job.createdAt).toLocaleDateString()} at{" "}
                            {new Date(job.createdAt).toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-3">
                        {getStatusBadge(job.status)}
                        
                        {job.status === "completed" && (job.outputPath || job.dropboxUrl) && (
                          <Button variant="outline" size="sm">
                            <Download className="w-3 h-3 mr-1" />
                            Download
                          </Button>
                        )}
                      </div>
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
                    <p className="text-2xl font-bold text-gray-900">{recentJobs.length}</p>
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
                    <p className="text-sm font-medium text-gray-600">Completed</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {recentJobs.filter(job => job.status === "completed").length}
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