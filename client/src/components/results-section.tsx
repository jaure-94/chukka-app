import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Download, Eye, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { ProcessingJob } from "@/lib/types";

interface ResultsSectionProps {
  job: ProcessingJob;
}

export function ResultsSection({ job }: ResultsSectionProps) {
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  const handleDownload = () => {
    window.open(`/api/download/${job.id}`, '_blank');
  };

  const handleDropboxExport = async () => {
    setIsExporting(true);
    try {
      const response = await fetch(`/api/export-dropbox/${job.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ folder: "Reports" }),
      });

      if (!response.ok) {
        throw new Error("Export failed");
      }

      toast({
        title: "Export successful",
        description: "File has been exported to your Dropbox.",
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: "Failed to export to Dropbox. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Report Generated</h3>
            <p className="text-sm text-gray-500">Your report has been generated and is ready for download.</p>
          </div>
          <div className="flex items-center text-green-600">
            <CheckCircle className="w-6 h-6 mr-2" />
            <span className="font-medium">Ready</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-gray-900">Excel Document Generated</h4>
              <span className="text-xs text-gray-500">XLSX</span>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Excel document generated from your data with individual tour rows.
            </p>
            <div className="flex space-x-2">
              <Button onClick={handleDownload} className="flex-1 bg-blue-600 hover:bg-blue-700">
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
              <Button variant="outline" size="icon">
                <Eye className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-gray-900">Dropbox Export</h4>
              <span className={`text-xs ${job.dropboxExported ? "text-green-600" : "text-gray-500"}`}>
                {job.dropboxExported ? "Exported" : "Not exported"}
              </span>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              {job.dropboxExported 
                ? "File automatically exported to Reports/ folder in your Dropbox."
                : "Export your processed file to Dropbox for easy sharing."
              }
            </p>
            {job.dropboxExported ? (
              <Button variant="outline" className="w-full">
                <ExternalLink className="w-4 h-4 mr-2" />
                Open in Dropbox
              </Button>
            ) : (
              <Button 
                onClick={handleDropboxExport} 
                disabled={isExporting}
                variant="outline" 
                className="w-full"
              >
                {isExporting ? "Exporting..." : "Export to Dropbox"}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
