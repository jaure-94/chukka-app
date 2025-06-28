import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileSpreadsheet, Download } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import type { ProcessingHistoryItem } from "@/lib/types";

export function ProcessingHistory() {
  const { data: history, isLoading } = useQuery<ProcessingHistoryItem[]>({
    queryKey: ["/api/history"],
  });

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return "Less than an hour ago";
    if (diffInHours === 1) return "1 hour ago";
    if (diffInHours < 24) return `${diffInHours} hours ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays === 1) return "Yesterday";
    return `${diffInDays} days ago`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-100 text-green-800 border-green-200">Success</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      case "processing":
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Processing</Badge>;
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  const handleDownload = (jobId: number) => {
    window.open(`/api/download/${jobId}`, '_blank');
  };

  return (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Processing History</h3>
        
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <Skeleton className="h-8 w-8" />
                  <div>
                    <Skeleton className="h-4 w-40 mb-1" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-8 w-8" />
                </div>
              </div>
            ))}
          </div>
        ) : history && history.length > 0 ? (
          <div className="space-y-3">
            {history.map((item) => (
              <div key={item.processingJobs.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                <div className="flex items-center space-x-3">
                  <FileSpreadsheet className="h-6 w-6 text-green-600" />
                  <div>
                    <div className="font-medium text-sm text-gray-900">
                      {item.uploadedFiles.originalName}
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatTimeAgo(item.processingJobs.createdAt)} • Template: {item.processingJobs.templateType}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {getStatusBadge(item.processingJobs.status)}
                  {item.processingJobs.status === "completed" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDownload(item.processingJobs.id)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-4">No processing history available.</p>
        )}
        
        {history && history.length > 0 && (
          <div className="mt-4 text-center">
            <Button variant="ghost" className="text-blue-600 hover:text-blue-700">
              View all history
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
