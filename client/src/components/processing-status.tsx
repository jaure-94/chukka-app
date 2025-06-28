import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, Clock, Loader2, XCircle } from "lucide-react";
import type { ProcessingJob } from "@/lib/types";

interface ProcessingStatusProps {
  job: ProcessingJob | null;
  isProcessing: boolean;
}

const statusSteps = [
  "File Upload",
  "JSON Parsing", 
  "Database Storage",
  "Template Processing",
  "Dropbox Export",
];

export function ProcessingStatus({ job, isProcessing }: ProcessingStatusProps) {
  const getStepStatus = (stepIndex: number) => {
    if (!job && stepIndex === 0) return "completed";
    if (!job) return "pending";
    
    if (job.status === "failed") {
      return stepIndex === 0 ? "completed" : "failed";
    }
    
    const progress = job.progress;
    if (stepIndex === 0) return "completed";
    if (stepIndex === 1 && progress >= 20) return "completed";
    if (stepIndex === 2 && progress >= 40) return "completed";
    if (stepIndex === 3 && progress >= 80) return "completed";
    if (stepIndex === 4 && progress >= 100) return "completed";
    
    if (isProcessing && stepIndex === Math.floor(progress / 20)) return "processing";
    
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
