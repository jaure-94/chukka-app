import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileSpreadsheet, Download, ChevronDown, ChevronUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import type { ProcessingJob, UploadedFile } from "@/lib/types";

type HistoryItem = ProcessingJob & { file: UploadedFile };

export function ProcessingHistory() {
  const [showAll, setShowAll] = useState(false);
  const { data: history, isLoading } = useQuery<HistoryItem[]>({
    queryKey: ["/api/history"],
  });

  const INITIAL_ITEMS_COUNT = 3;
  const displayedItems = showAll ? history : history?.slice(0, INITIAL_ITEMS_COUNT);

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
            {displayedItems?.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                <div className="flex items-center space-x-3">
                  <FileSpreadsheet className="h-6 w-6 text-green-600" />
                  <div>
                    <div className="font-medium text-sm text-gray-900">
                      {item.file?.originalName || 'Unknown file'}
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatTimeAgo(item.createdAt)} • Template: {item.templateType}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {getStatusBadge(item.status)}
                  {item.status === "completed" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDownload(item.id)}
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
        
        {history && history.length > INITIAL_ITEMS_COUNT && (
          <div className="mt-4 text-center">
            <Button 
              variant="ghost" 
              className="text-blue-600 hover:text-blue-700"
              onClick={() => setShowAll(!showAll)}
            >
              {showAll ? (
                <>
                  <ChevronUp className="h-4 w-4 mr-1" />
                  View Less
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4 mr-1" />
                  View More ({history.length - INITIAL_ITEMS_COUNT} more)
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
