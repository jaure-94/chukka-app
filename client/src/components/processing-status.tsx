import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, Clock, Loader2, XCircle } from "lucide-react";
import type { ProcessingJob, UploadResponse } from "@/lib/types";

interface ProcessingStatusProps {
  job: ProcessingJob | null;
  isProcessing: boolean;
  uploadResponse: UploadResponse | null;
}

const statusSteps = [
  "Document Upload",
  "Data Preview", 
  "Report Generation",
  "Export",
];

export function ProcessingStatus({ job, isProcessing, uploadResponse }: ProcessingStatusProps) {
  const getStepStatus = (stepIndex: number) => {
    // Step 0: Document Upload - completed if we have upload response
    if (stepIndex === 0) return uploadResponse ? "completed" : "pending";
    
    // Step 1: Data Preview - completed if we have upload response (file uploaded and previewed)
    if (stepIndex === 1) return uploadResponse ? "completed" : "pending";
    
    // Step 2: Report Generation - based on job status
    if (stepIndex === 2) {
      if (!job) return "pending";
      if (job.status === "failed") return "failed";
      if (job.status === "processing") return "processing";
      if (job.status === "completed") return "completed";
      return "pending";
    }
    
    // Step 3: Export - completed only if job is completed and exported
    if (stepIndex === 3) {
      if (!job) return "pending";
      if (job.status === "completed" && job.dropboxExported) return "completed";
      if (job.status === "completed") return "pending";
      return "pending";
    }
    
    return "pending";
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case "processing":
        return <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />;
      case "failed":
        return <XCircle className="w-4 h-4 text-red-600" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Processing Status</h3>
        
        <div className="space-y-4">
          {statusSteps.map((step, index) => {
            const status = getStepStatus(index);
            return (
              <div key={index} className="flex items-center justify-between">
                <span className={`text-sm ${
                  status === "completed" || status === "processing" 
                    ? "text-gray-900" 
                    : "text-gray-400"
                }`}>
                  {step}
                </span>
                {getStatusIcon(status)}
              </div>
            );
          })}
        </div>

        {job && (
          <div className="mt-6">
            <Progress value={job.progress} className="h-2" />
            <p className="text-xs text-gray-500 mt-2">
              {job.status === "failed" 
                ? `Failed: ${job.errorMessage || "Unknown error"}`
                : job.status === "completed"
                  ? "Processing complete!"
                  : `Processing... ${job.progress}% complete`
              }
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
