import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  History, 
  Mail, 
  Cloud, 
  FileText, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Calendar,
  User,
  RefreshCw,
  ExternalLink
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface ShareHistoryProps {
  shipId: string;
  limit?: number;
}

interface SharingActivity {
  id: number;
  shipId: string;
  reportTypes: ('eod' | 'dispatch' | 'pax')[];
  shareMethod: string;
  recipients?: string[];
  emailStatus?: string;
  dropboxStatus?: string;
  status: string;
  createdAt: string;
  completedAt?: string;
  metadata?: {
    reportFilenames?: string[];
    sharedBy?: string;
    failedRecipients?: string[];
    emailSubject?: string;
  };
}

export function ShareHistory({ shipId, limit = 20 }: ShareHistoryProps) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['/api/sharing/history', { shipId, limit }],
  });

  const activities: SharingActivity[] = data || [];

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'sent':
      case 'uploaded':
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'partial':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-blue-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'sent':
      case 'uploaded':
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      case 'partial':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'pending':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  const getShipName = (shipId: string) => {
    const names = {
      'ship-a': 'Ship A',
      'ship-b': 'Ship B',
      'ship-c': 'Ship C',
    };
    return names[shipId as keyof typeof names] || shipId.toUpperCase();
  };

  const formatDuration = (startDate: string, endDate?: string) => {
    if (!endDate) return 'In progress';
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffMs = end.getTime() - start.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    
    if (diffSeconds < 60) return `${diffSeconds}s`;
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes}m ${diffSeconds % 60}s`;
    const diffHours = Math.floor(diffMinutes / 60);
    return `${diffHours}h ${diffMinutes % 60}m`;
  };

  if (error) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center space-y-2">
            <XCircle className="h-8 w-8 text-red-600 mx-auto" />
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Failed to load sharing history
            </p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Sharing History
            {shipId && (
              <Badge variant="outline">
                {getShipName(shipId)}
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[400px] px-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : activities.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-center space-y-2">
                <History className="h-8 w-8 text-gray-400 mx-auto" />
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  No sharing history yet
                </p>
                <p className="text-xs text-gray-500">
                  Share some reports to see them here
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4 pb-6">
              {activities.map((activity, index) => (
                <div key={activity.id}>
                  <div className="space-y-3">
                    {/* Activity Header */}
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(activity.status)}
                          <span className="font-medium text-sm">
                            Activity #{activity.id}
                          </span>
                          <Badge className={getStatusColor(activity.status)}>
                            {activity.status.charAt(0).toUpperCase() + activity.status.slice(1)}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(activity.createdAt), 'MMM dd, yyyy HH:mm')}
                          {activity.completedAt && (
                            <>
                              <span>•</span>
                              <span>{formatDuration(activity.createdAt, activity.completedAt)}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <Button variant="ghost" size="sm">
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </div>

                    {/* Reports Shared */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-gray-400" />
                        <span className="text-sm font-medium">Reports:</span>
                        <div className="flex flex-wrap gap-1">
                          {activity.reportTypes.map(type => (
                            <Badge key={type} variant="outline" className="text-xs">
                              {type.toUpperCase()}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      {/* Share Method Status */}
                      <div className="flex items-center gap-4 ml-6">
                        {activity.shareMethod.includes('email') && (
                          <div className="flex items-center gap-2">
                            <Mail className="h-3 w-3 text-gray-400" />
                            <span className="text-xs">Email</span>
                            {getStatusIcon(activity.emailStatus)}
                          </div>
                        )}
                        {activity.shareMethod.includes('dropbox') && (
                          <div className="flex items-center gap-2">
                            <Cloud className="h-3 w-3 text-gray-400" />
                            <span className="text-xs">Dropbox</span>
                            {getStatusIcon(activity.dropboxStatus)}
                          </div>
                        )}
                      </div>

                      {/* Recipients */}
                      {activity.recipients && activity.recipients.length > 0 && (
                        <div className="flex items-center gap-2 ml-6">
                          <User className="h-3 w-3 text-gray-400" />
                          <span className="text-xs text-gray-500">
                            {activity.recipients.length} recipient{activity.recipients.length > 1 ? 's' : ''}
                          </span>
                          {activity.metadata?.failedRecipients && activity.metadata.failedRecipients.length > 0 && (
                            <Badge variant="destructive" className="text-xs">
                              {activity.metadata.failedRecipients.length} failed
                            </Badge>
                          )}
                        </div>
                      )}

                      {/* Shared By */}
                      {activity.metadata?.sharedBy && (
                        <div className="flex items-center gap-2 ml-6">
                          <User className="h-3 w-3 text-gray-400" />
                          <span className="text-xs text-gray-500">
                            Shared by {activity.metadata.sharedBy}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {index < activities.length - 1 && (
                    <Separator className="mt-4" />
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}