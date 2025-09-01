import { useEffect, useState } from "react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle, 
  Mail, 
  Cloud, 
  FileText,
  Loader2,
  Download,
  ExternalLink
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ShareProgressProps {
  status: 'idle' | 'preparing' | 'sharing' | 'completed' | 'failed';
  progress: number;
  currentStep: string;
  emailStatus: 'pending' | 'sent' | 'failed';
  dropboxStatus: 'pending' | 'uploaded' | 'failed';
  shareMethod: 'email' | 'dropbox' | 'both';
  selectedReports: ('eod' | 'dispatch' | 'pax')[];
  sharingActivityId?: number | null;
}

const progressSteps = [
  { key: 'preparing', label: 'Preparing Reports', progress: 20 },
  { key: 'validating', label: 'Validating Recipients', progress: 40 },
  { key: 'processing', label: 'Processing Files', progress: 60 },
  { key: 'sharing', label: 'Sharing Reports', progress: 80 },
  { key: 'completed', label: 'Share Complete', progress: 100 }
];

export function ShareProgress({
  status,
  progress,
  currentStep,
  emailStatus,
  dropboxStatus,
  shareMethod,
  selectedReports,
  sharingActivityId
}: ShareProgressProps) {
  const [animatedProgress, setAnimatedProgress] = useState(0);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  useEffect(() => {
    // Animate progress bar
    const timer = setTimeout(() => {
      setAnimatedProgress(progress);
    }, 100);

    // Update current step based on progress
    const stepIndex = progressSteps.findIndex(step => step.progress >= progress);
    if (stepIndex !== -1) {
      setCurrentStepIndex(stepIndex);
    }

    return () => clearTimeout(timer);
  }, [progress]);

  const getStatusIcon = (serviceStatus: string, isActive: boolean = false) => {
    switch (serviceStatus) {
      case 'sent':
      case 'uploaded':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'pending':
        return isActive ? (
          <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
        ) : (
          <Clock className="h-4 w-4 text-gray-400" />
        );
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (serviceStatus: string) => {
    switch (serviceStatus) {
      case 'sent':
      case 'uploaded':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  const isCompleted = status === 'completed';
  const isFailed = status === 'failed';
  const isInProgress = ['preparing', 'sharing'].includes(status);

  return (
    <div className="space-y-6">
      {/* Overall Progress */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            {isCompleted && <CheckCircle className="h-5 w-5 text-green-600" />}
            {isFailed && <XCircle className="h-5 w-5 text-red-600" />}
            {isInProgress && <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />}
            {status === 'idle' && <Clock className="h-5 w-5 text-gray-400" />}
            Sharing Progress
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{currentStep}</span>
              <span className="text-gray-600 dark:text-gray-400">{Math.round(animatedProgress)}%</span>
            </div>
            <Progress 
              value={animatedProgress} 
              className={cn(
                "h-2 transition-all duration-500",
                isCompleted && "bg-green-100 dark:bg-green-900",
                isFailed && "bg-red-100 dark:bg-red-900"
              )}
            />
          </div>

          {/* Progress Steps */}
          <div className="grid gap-2">
            {progressSteps.map((step, index) => (
              <div
                key={step.key}
                className={cn(
                  "flex items-center gap-3 p-2 rounded-lg transition-all duration-200",
                  index === currentStepIndex && isInProgress && "bg-blue-50 dark:bg-blue-950",
                  index < currentStepIndex && "opacity-75"
                )}
              >
                <div className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center transition-all",
                  index < currentStepIndex 
                    ? "bg-green-100 dark:bg-green-900" 
                    : index === currentStepIndex && isInProgress
                    ? "bg-blue-100 dark:bg-blue-900"
                    : "bg-gray-100 dark:bg-gray-800"
                )}>
                  {index < currentStepIndex ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : index === currentStepIndex && isInProgress ? (
                    <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
                  ) : (
                    <span className="text-xs font-medium text-gray-400">{index + 1}</span>
                  )}
                </div>
                <span className={cn(
                  "text-sm font-medium transition-colors",
                  index === currentStepIndex && isInProgress && "text-blue-600 dark:text-blue-400"
                )}>
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Service Status */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Email Status */}
        {(shareMethod === 'email' || shareMethod === 'both') && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Mail className="h-4 w-4" />
                Email Sharing
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getStatusIcon(emailStatus, isInProgress)}
                  <span className="text-sm font-medium">
                    {emailStatus === 'sent' && 'Successfully sent'}
                    {emailStatus === 'failed' && 'Failed to send'}
                    {emailStatus === 'pending' && (isInProgress ? 'Sending...' : 'Waiting')}
                  </span>
                </div>
                <Badge className={getStatusColor(emailStatus)}>
                  {emailStatus.charAt(0).toUpperCase() + emailStatus.slice(1)}
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Dropbox Status */}
        {(shareMethod === 'dropbox' || shareMethod === 'both') && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Cloud className="h-4 w-4" />
                Dropbox Sharing
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getStatusIcon(dropboxStatus, isInProgress)}
                  <span className="text-sm font-medium">
                    {dropboxStatus === 'uploaded' && 'Successfully uploaded'}
                    {dropboxStatus === 'failed' && 'Failed to upload'}
                    {dropboxStatus === 'pending' && (isInProgress ? 'Uploading...' : 'Waiting')}
                  </span>
                </div>
                <Badge className={getStatusColor(dropboxStatus)}>
                  {dropboxStatus.charAt(0).toUpperCase() + dropboxStatus.slice(1)}
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Report Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" />
            Shared Reports
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {selectedReports.map((reportType) => (
              <div key={reportType} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <span className="font-medium">{reportType.toUpperCase()} Report</span>
                <div className="flex items-center gap-2">
                  {isCompleted && <CheckCircle className="h-4 w-4 text-green-600" />}
                  {isFailed && <XCircle className="h-4 w-4 text-red-600" />}
                  {isInProgress && <Clock className="h-4 w-4 text-blue-600" />}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Success/Error Messages */}
      {isCompleted && (
        <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800 dark:text-green-300">
            <div className="space-y-1">
              <p className="font-medium">Reports shared successfully!</p>
              <p className="text-sm">
                {selectedReports.length} report{selectedReports.length > 1 ? 's' : ''} shared via {shareMethod}
                {sharingActivityId && ` (Activity ID: #${sharingActivityId})`}
              </p>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {isFailed && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-1">
              <p className="font-medium">Sharing failed</p>
              <p className="text-sm">{currentStep}</p>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Action Buttons */}
      {isCompleted && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            View Activity Details
          </Button>
          <Button variant="outline" size="sm">
            <ExternalLink className="h-4 w-4 mr-2" />
            Share Another
          </Button>
        </div>
      )}
    </div>
  );
}