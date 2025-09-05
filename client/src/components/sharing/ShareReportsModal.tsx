import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RecipientInput } from "./RecipientInput";
import { ShareProgress } from "./ShareProgress";
import { ShareHistory } from "./ShareHistory";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Share, 
  Mail, 
  Cloud, 
  Ship, 
  FileText, 
  Users, 
  CheckCircle, 
  XCircle, 
  Clock,
  AlertTriangle
} from "lucide-react";

interface ShareReportsModalProps {
  isOpen: boolean;
  onClose: () => void;
  shipId: string;
  availableReports: {
    eod?: { filename: string; path: string; };
    dispatch?: { filename: string; path: string; };
    pax?: { filename: string; path: string; };
    'consolidated-pax'?: { filename: string; path: string; };
  };
  preSelectedReports?: ('eod' | 'dispatch' | 'pax' | 'consolidated-pax')[];
}

interface ShareResult {
  success: boolean;
  message: string;
  sharingActivityId: number;
  details?: {
    emailResult?: any;
    dropboxResult?: any;
  };
}

export function ShareReportsModal({ 
  isOpen, 
  onClose, 
  shipId, 
  availableReports,
  preSelectedReports = []
}: ShareReportsModalProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<string>("configure");
  const [selectedReports, setSelectedReports] = useState<('eod' | 'dispatch' | 'pax' | 'consolidated-pax')[]>(preSelectedReports);
  const [shareMethod, setShareMethod] = useState<'email' | 'dropbox' | 'both'>('email');
  const [recipients, setRecipients] = useState<string[]>([]);
  const [currentSharingId, setCurrentSharingId] = useState<number | null>(null);
  const [shareProgress, setShareProgress] = useState({
    status: 'idle' as 'idle' | 'preparing' | 'sharing' | 'completed' | 'failed',
    progress: 0,
    currentStep: '',
    emailStatus: 'pending' as 'pending' | 'sent' | 'failed',
    dropboxStatus: 'pending' as 'pending' | 'uploaded' | 'failed'
  });

  const shareReportsMutation = useMutation({
    mutationFn: async (data: {
      shareMethod: string;
      reportTypes: string[];
      recipients: string[];
      shipId: string;
      availableReports: any;
    }): Promise<ShareResult> => {
      setShareProgress(prev => ({
        ...prev,
        status: 'preparing',
        progress: 10,
        currentStep: 'Preparing reports for sharing...'
      }));

      const response = await apiRequest('POST', '/api/sharing/share', data);
      const result = await response.json();
      
      return result;
    },
    onSuccess: (result: ShareResult) => {
      setCurrentSharingId(result.sharingActivityId);
      
      if (result.success) {
        setShareProgress({
          status: 'completed',
          progress: 100,
          currentStep: 'Reports shared successfully!',
          emailStatus: result.details?.emailResult?.success ? 'sent' : 'failed',
          dropboxStatus: result.details?.dropboxResult?.success ? 'uploaded' : 'failed'
        });
        
        toast({
          title: "Reports Shared Successfully",
          description: result.message,
        });
        
        setActiveTab("progress");
      } else {
        setShareProgress(prev => ({
          ...prev,
          status: 'failed',
          currentStep: `Sharing failed: ${result.message}`
        }));
        
        toast({
          title: "Sharing Failed",
          description: result.message,
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      setShareProgress(prev => ({
        ...prev,
        status: 'failed',
        currentStep: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      }));
      
      toast({
        title: "Sharing Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    },
  });

  const handleShare = () => {
    if (selectedReports.length === 0) {
      toast({
        title: "No Reports Selected",
        description: "Please select at least one report to share",
        variant: "destructive",
      });
      return;
    }

    if ((shareMethod === 'email' || shareMethod === 'both') && recipients.length === 0) {
      toast({
        title: "Recipients Required",
        description: "Please add email recipients for email sharing",
        variant: "destructive",
      });
      return;
    }

    setShareProgress({
      status: 'sharing',
      progress: 20,
      currentStep: 'Initiating sharing process...',
      emailStatus: 'pending',
      dropboxStatus: 'pending'
    });

    setActiveTab("progress");

    shareReportsMutation.mutate({
      shareMethod,
      reportTypes: selectedReports,
      recipients,
      shipId,
      availableReports,
    });
  };

  const resetModal = () => {
    setSelectedReports(preSelectedReports);
    setShareMethod('email');
    setRecipients([]);
    setCurrentSharingId(null);
    setShareProgress({
      status: 'idle',
      progress: 0,
      currentStep: '',
      emailStatus: 'pending',
      dropboxStatus: 'pending'
    });
    setActiveTab("configure");
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  const getShipName = (shipId: string) => {
    const names = {
      'ship-a': 'Ship A',
      'ship-b': 'Ship B',
      'ship-c': 'Ship C',
      'consolidated': 'All Ships (Consolidated)',
    };
    return names[shipId as keyof typeof names] || shipId.toUpperCase();
  };

  const getReportTypeLabel = (reportType: string) => {
    const labels = {
      'eod': 'End of Day (EOD)',
      'dispatch': 'Dispatch Sheet',
      'pax': 'PAX Report',
      'consolidated-pax': 'Consolidated PAX Report',
    };
    return labels[reportType as keyof typeof labels] || reportType.toUpperCase();
  };

  const getAvailableReportCount = () => {
    return Object.keys(availableReports).length;
  };

  useEffect(() => {
    if (isOpen && preSelectedReports.length > 0) {
      setSelectedReports(preSelectedReports);
    }
  }, [isOpen, preSelectedReports]);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl w-[95vw] h-[95vh] max-h-[95vh] p-0 flex flex-col overflow-hidden">
        <div className="flex flex-col h-full overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
            <DialogTitle className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900">
                <Share className="h-5 w-5 text-blue-600 dark:text-blue-300" />
              </div>
              <div>
                <div className="text-xl font-semibold">Share Maritime Reports</div>
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 mt-1">
                  <Ship className="h-4 w-4" />
                  <Badge variant="outline">{getShipName(shipId)}</Badge>
                  <span>•</span>
                  <span>{getAvailableReportCount()} reports available</span>
                </div>
              </div>
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-hidden px-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
              <TabsList className="grid w-full grid-cols-3 my-4 shrink-0">
                <TabsTrigger value="configure" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  <span className="hidden sm:inline">Configure</span>
                </TabsTrigger>
                <TabsTrigger value="progress" className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span className="hidden sm:inline">Progress</span>
                </TabsTrigger>
                <TabsTrigger value="history" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span className="hidden sm:inline">History</span>
                </TabsTrigger>
              </TabsList>

              <div className="flex-1 min-h-0 overflow-auto pr-2 -mr-2">
                <TabsContent value="configure" className="mt-0 space-y-6">
                  <div className="grid gap-6 md:grid-cols-2">
                    {/* Report Selection */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-blue-600" />
                        <Label className="text-base font-medium">Select Reports</Label>
                      </div>
                      
                      <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        {(['eod', 'dispatch', 'pax', 'consolidated-pax'] as const).map((reportType) => {
                          const available = availableReports[reportType];
                          return (
                            <div key={reportType} className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <Checkbox
                                  id={reportType}
                                  checked={selectedReports.includes(reportType)}
                                  disabled={!available}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setSelectedReports([...selectedReports, reportType]);
                                    } else {
                                      setSelectedReports(selectedReports.filter(r => r !== reportType));
                                    }
                                  }}
                                />
                                <Label 
                                  htmlFor={reportType} 
                                  className={`font-medium ${!available ? 'opacity-50' : ''}`}
                                >
                                  {getReportTypeLabel(reportType)}
                                </Label>
                              </div>
                              <div className="flex items-center gap-2">
                                {available ? (
                                  <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                                    Available
                                  </Badge>
                                ) : (
                                  <Badge variant="destructive">
                                    Not Available
                                  </Badge>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {selectedReports.length > 0 && (
                        <Alert>
                          <CheckCircle className="h-4 w-4" />
                          <AlertDescription>
                            {selectedReports.length} report{selectedReports.length > 1 ? 's' : ''} selected: {selectedReports.map(r => r.toUpperCase()).join(', ')}
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>

                    {/* Sharing Method & Recipients */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <Share className="h-5 w-5 text-blue-600" />
                        <Label className="text-base font-medium">Sharing Method</Label>
                      </div>

                      <Select value={shareMethod} onValueChange={setShareMethod as any}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="email">
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4" />
                              Email Only
                            </div>
                          </SelectItem>
                          <SelectItem value="dropbox">
                            <div className="flex items-center gap-2">
                              <Cloud className="h-4 w-4" />
                              Dropbox Only
                            </div>
                          </SelectItem>
                          <SelectItem value="both">
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4" />
                              <Cloud className="h-4 w-4" />
                              Email & Dropbox
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>

                      {(shareMethod === 'email' || shareMethod === 'both') && (
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Email Recipients</Label>
                          <RecipientInput
                            recipients={recipients}
                            onRecipientsChange={setRecipients}
                            placeholder="Enter email addresses..."
                          />
                        </div>
                      )}

                      {shareMethod === 'dropbox' && (
                        <Alert>
                          <Cloud className="h-4 w-4" />
                          <AlertDescription>
                            Reports will be uploaded to Dropbox with organized folder structure by ship and date. Shared links will be generated automatically.
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  </div>
                  
                  {/* Action Buttons at bottom of scrollable content */}
                  <div className="flex items-center justify-between pt-6 pb-2 border-t">
                    <Button variant="outline" onClick={handleClose}>
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleShare}
                      disabled={selectedReports.length === 0 || shareReportsMutation.isPending}
                      className="min-w-[120px]"
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
                  </div>
                </TabsContent>

                <TabsContent value="progress" className="mt-0">
                  <ShareProgress
                    status={shareProgress.status}
                    progress={shareProgress.progress}
                    currentStep={shareProgress.currentStep}
                    emailStatus={shareProgress.emailStatus}
                    dropboxStatus={shareProgress.dropboxStatus}
                    shareMethod={shareMethod}
                    selectedReports={selectedReports}
                    sharingActivityId={currentSharingId}
                  />
                </TabsContent>

                <TabsContent value="history" className="mt-0">
                  <ShareHistory shipId={shipId} />
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}