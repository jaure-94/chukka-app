import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SidebarNavigation, MobileNavigation } from "@/components/sidebar-navigation";
import { useToast } from "@/hooks/use-toast";
import { useSidebar } from "@/contexts/sidebar-context";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Share, Mail, Cloud, History, Settings, CheckCircle, XCircle, Clock, AlertCircle } from "lucide-react";
import { format } from "date-fns";

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
  };
}

export default function SharingPage() {
  const { toast } = useToast();
  const { isCollapsed } = useSidebar();
  const [shareMethod, setShareMethod] = useState<'email' | 'dropbox' | 'both'>('email');
  const [selectedReports, setSelectedReports] = useState<('eod' | 'dispatch' | 'pax')[]>(['eod']);
  const [selectedShip, setSelectedShip] = useState<string>('ship-a');
  const [recipients, setRecipients] = useState<string>('');

  // Fetch sharing history
  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['/api/sharing/history'],
  });

  // Fetch service status
  const { data: serviceStatus, isLoading: serviceLoading } = useQuery({
    queryKey: ['/api/sharing/test-services'],
  });

  // Share reports mutation
  const shareReportsMutation = useMutation({
    mutationFn: async (data: {
      shareMethod: string;
      reportTypes: string[];
      recipients?: string[];
      shipId: string;
    }) => {
      const response = await apiRequest('POST', '/api/sharing/share', data);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "Reports Shared Successfully",
          description: data.message,
        });
        queryClient.invalidateQueries({ queryKey: ['/api/sharing/history'] });
      } else {
        toast({
          title: "Sharing Failed",
          description: data.message,
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Sharing Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  const handleShare = () => {
    const recipientList = recipients
      .split(',')
      .map(email => email.trim())
      .filter(email => email.length > 0);

    if ((shareMethod === 'email' || shareMethod === 'both') && recipientList.length === 0) {
      toast({
        title: "Recipients Required",
        description: "Please provide email recipients for email sharing",
        variant: "destructive",
      });
      return;
    }

    shareReportsMutation.mutate({
      shareMethod,
      reportTypes: selectedReports,
      recipients: recipientList,
      shipId: selectedShip,
    });
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'sent':
      case 'uploaded':
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-400" />;
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

  return (
    <div className="flex h-screen overflow-hidden bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-blue-900 dark:to-indigo-900">
      <SidebarNavigation />
      <MobileNavigation />
      
      <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${isCollapsed ? 'ml-16' : 'ml-64'}`}>
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3 mb-8">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900">
                <Share className="h-6 w-6 text-blue-600 dark:text-blue-300" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  Document Sharing
                </h1>
                <p className="text-gray-600 dark:text-gray-300">
                  Share maritime reports via email and cloud storage
                </p>
              </div>
            </div>

            {/* Service Status */}
            {serviceStatus && (
            <Alert className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Email: 
                    {serviceStatus.email?.success ? (
                      <Badge variant="secondary" className="bg-green-100 text-green-800">Ready</Badge>
                    ) : (
                      <Badge variant="destructive">Not Available</Badge>
                    )}
                  </span>
                  <span className="flex items-center gap-2">
                    <Cloud className="h-4 w-4" />
                    Dropbox: 
                    {serviceStatus.dropbox?.success ? (
                      <Badge variant="secondary" className="bg-green-100 text-green-800">Ready</Badge>
                    ) : (
                      <Badge variant="destructive">Not Available</Badge>
                    )}
                  </span>
                </div>
              </AlertDescription>
            </Alert>
          )}

          <Tabs defaultValue="share" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="share">Share Reports</TabsTrigger>
              <TabsTrigger value="history">Sharing History</TabsTrigger>
            </TabsList>

            <TabsContent value="share">
              <div className="grid gap-6 md:grid-cols-2">
                {/* Share Configuration */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Share className="h-5 w-5" />
                      Share Configuration
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Ship Selection */}
                    <div className="space-y-2">
                      <Label htmlFor="ship">Ship</Label>
                      <Select value={selectedShip} onValueChange={setSelectedShip}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ship-a">Ship A</SelectItem>
                          <SelectItem value="ship-b">Ship B</SelectItem>
                          <SelectItem value="ship-c">Ship C</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Report Types */}
                    <div className="space-y-2">
                      <Label>Report Types</Label>
                      <div className="space-y-2">
                        {['eod', 'dispatch', 'pax'].map((type) => (
                          <div key={type} className="flex items-center space-x-2">
                            <Checkbox
                              id={type}
                              checked={selectedReports.includes(type as any)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedReports([...selectedReports, type as any]);
                                } else {
                                  setSelectedReports(selectedReports.filter(r => r !== type));
                                }
                              }}
                            />
                            <Label htmlFor={type} className="text-sm font-medium">
                              {type.toUpperCase()} Report
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Share Method */}
                    <div className="space-y-2">
                      <Label>Share Method</Label>
                      <Select value={shareMethod} onValueChange={setShareMethod as any}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="email">Email Only</SelectItem>
                          <SelectItem value="dropbox">Dropbox Only</SelectItem>
                          <SelectItem value="both">Email & Dropbox</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Recipients (for email) */}
                    {(shareMethod === 'email' || shareMethod === 'both') && (
                      <div className="space-y-2">
                        <Label htmlFor="recipients">Email Recipients</Label>
                        <Textarea
                          id="recipients"
                          placeholder="Enter email addresses separated by commas"
                          value={recipients}
                          onChange={(e) => setRecipients(e.target.value)}
                          rows={3}
                        />
                        <p className="text-sm text-gray-500">
                          Separate multiple email addresses with commas
                        </p>
                      </div>
                    )}

                    <Button 
                      onClick={handleShare} 
                      className="w-full" 
                      disabled={shareReportsMutation.isPending || selectedReports.length === 0}
                    >
                      {shareReportsMutation.isPending ? (
                        <>
                          <Clock className="mr-2 h-4 w-4 animate-spin" />
                          Sharing...
                        </>
                      ) : (
                        <>
                          <Share className="mr-2 h-4 w-4" />
                          Share Reports
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>

                {/* Preview Card */}
                <Card>
                  <CardHeader>
                    <CardTitle>Share Preview</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge>{getShipName(selectedShip)}</Badge>
                      </div>
                      <div>
                        <span className="text-sm text-gray-600 dark:text-gray-300">Reports:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {selectedReports.map(type => (
                            <Badge key={type} variant="outline">{type.toUpperCase()}</Badge>
                          ))}
                        </div>
                      </div>
                      <div>
                        <span className="text-sm text-gray-600 dark:text-gray-300">Method:</span>
                        <Badge variant="secondary" className="ml-2">
                          {shareMethod === 'both' ? 'Email + Dropbox' : shareMethod.charAt(0).toUpperCase() + shareMethod.slice(1)}
                        </Badge>
                      </div>
                      {recipients && (
                        <div>
                          <span className="text-sm text-gray-600 dark:text-gray-300">Recipients:</span>
                          <p className="text-sm mt-1">{recipients.split(',').length} recipient(s)</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="history">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <History className="h-5 w-5" />
                    Recent Sharing Activity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {historyLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Clock className="h-6 w-6 animate-spin" />
                    </div>
                  ) : historyData?.history?.length > 0 ? (
                    <div className="space-y-4">
                      {historyData.history.map((activity: SharingActivity) => (
                        <div key={activity.id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Badge>{getShipName(activity.shipId)}</Badge>
                              <span className="text-sm text-gray-600">
                                {activity.reportTypes.map(t => t.toUpperCase()).join(', ')}
                              </span>
                            </div>
                            <p className="text-sm text-gray-500">
                              {format(new Date(activity.createdAt), 'MMM dd, yyyy HH:mm')}
                              {activity.metadata?.sharedBy && ` • by ${activity.metadata.sharedBy}`}
                            </p>
                            {activity.recipients && activity.recipients.length > 0 && (
                              <p className="text-xs text-gray-400">
                                Recipients: {activity.recipients.join(', ')}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {activity.shareMethod.includes('email') && (
                              <div className="flex items-center gap-1">
                                <Mail className="h-4 w-4" />
                                {getStatusIcon(activity.emailStatus)}
                              </div>
                            )}
                            {activity.shareMethod.includes('dropbox') && (
                              <div className="flex items-center gap-1">
                                <Cloud className="h-4 w-4" />
                                {getStatusIcon(activity.dropboxStatus)}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      No sharing activity yet. Share some reports to see them here.
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}