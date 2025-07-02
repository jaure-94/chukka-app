import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

// Form validation schema
const dispatchFormSchema = z.object({
  adults: z.number().min(0, "Number of adults must be 0 or greater"),
  children: z.number().min(0, "Number of children must be 0 or greater"),
  notes: z.string().optional(),
});

type DispatchFormData = z.infer<typeof dispatchFormSchema>;

interface ProcessingJob {
  id: number;
  status: string;
  templateType: string;
  outputPath?: string;
  dropboxUrl?: string;
  createdAt: string;
}

export default function CreateDispatch() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [templateData, setTemplateData] = useState<any>(null);
  const [currentJob, setCurrentJob] = useState<ProcessingJob | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Load template data from sessionStorage
  useEffect(() => {
    const storedData = sessionStorage.getItem('templateData');
    if (storedData) {
      setTemplateData(JSON.parse(storedData));
    } else {
      // If no template data, redirect back to upload page
      setLocation('/');
    }
  }, [setLocation]);

  // Form setup
  const form = useForm<DispatchFormData>({
    resolver: zodResolver(dispatchFormSchema),
    defaultValues: {
      adults: 0,
      children: 0,
      notes: "",
    },
  });

  // Create dispatch record mutation
  const createDispatchMutation = useMutation({
    mutationFn: async (data: DispatchFormData) => {
      const response = await apiRequest("POST", "/api/dispatch-records", {
        tourName: "Manual Entry",
        adults: data.adults,
        children: data.children,
        notes: data.notes || "",
        isActive: true,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Dispatch record created successfully",
      });
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/dispatch-records"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create dispatch record",
        variant: "destructive",
      });
      console.error("Error creating dispatch record:", error);
    },
  });

  // Generate report mutation
  const generateReportMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/process", {
        dispatchFileId: templateData?.dispatch?.file?.id || 1,
        eodFileId: templateData?.eod?.file?.id || 1,
        templateType: "eod-template",
      });
      return await response.json();
    },
    onSuccess: (job) => {
      setCurrentJob(job);
      setIsProcessing(true);
      toast({
        title: "Processing Started",
        description: "Your report is being generated",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to start report generation",
        variant: "destructive",
      });
      console.error("Error generating report:", error);
    },
  });

  const onSubmit = (data: DispatchFormData) => {
    createDispatchMutation.mutate(data);
  };

  const handleGenerateReport = () => {
    generateReportMutation.mutate();
  };

  const handleBackToUpload = () => {
    sessionStorage.removeItem('templateData');
    setLocation('/');
  };

  if (!templateData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card>
          <CardContent className="p-6">
            <p className="text-gray-600">Loading template data...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Create Dispatch Record</h1>
              <p className="mt-2 text-gray-600">
                Add dispatch information and generate your report
              </p>
            </div>
            <Button variant="outline" onClick={handleBackToUpload}>
              Back to Upload
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Create Dispatch Record Form */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Create new dispatch record</h2>
            
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Number of Adults */}
                <div className="space-y-2">
                  <Label htmlFor="adults" className="text-sm font-medium text-gray-700">
                    Number of Adults
                  </Label>
                  <Input
                    id="adults"
                    type="number"
                    min="0"
                    {...form.register("adults", { valueAsNumber: true })}
                    className="w-full"
                  />
                  {form.formState.errors.adults && (
                    <p className="text-sm text-red-600">
                      {form.formState.errors.adults.message}
                    </p>
                  )}
                </div>

                {/* Number of Children */}
                <div className="space-y-2">
                  <Label htmlFor="children" className="text-sm font-medium text-gray-700">
                    Number of Children
                  </Label>
                  <Input
                    id="children"
                    type="number"
                    min="0"
                    {...form.register("children", { valueAsNumber: true })}
                    className="w-full"
                  />
                  {form.formState.errors.children && (
                    <p className="text-sm text-red-600">
                      {form.formState.errors.children.message}
                    </p>
                  )}
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes" className="text-sm font-medium text-gray-700">
                  Notes
                </Label>
                <Textarea
                  id="notes"
                  {...form.register("notes")}
                  placeholder="Enter any additional notes..."
                  className="w-full min-h-[100px]"
                />
                {form.formState.errors.notes && (
                  <p className="text-sm text-red-600">
                    {form.formState.errors.notes.message}
                  </p>
                )}
              </div>

              {/* Submit Button */}
              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={createDispatchMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {createDispatchMutation.isPending ? "Creating..." : "Create Record"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Generate Report Section */}
        <Card>
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Generate Report</h2>
            
            <div className="space-y-4">
              <p className="text-gray-600">
                Ready to generate your EOD report using the uploaded templates and dispatch records.
              </p>
              
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-gray-900">Report Generation</h3>
                  <p className="text-sm text-gray-500">
                    Create EOD report from your templates and data
                  </p>
                </div>
                <Button
                  onClick={handleGenerateReport}
                  disabled={generateReportMutation.isPending || isProcessing}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {generateReportMutation.isPending || isProcessing ? "Generating..." : "Generate Report"}
                </Button>
              </div>

              {/* Processing Status */}
              {currentJob && (
                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-blue-900">Processing Status</h4>
                      <p className="text-sm text-blue-700">
                        Status: {currentJob.status}
                      </p>
                    </div>
                    {currentJob.status === "completed" && currentJob.outputPath && (
                      <div className="space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(`/api/download/${currentJob.id}`, '_blank')}
                        >
                          Download Report
                        </Button>
                        {currentJob.dropboxUrl && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(currentJob.dropboxUrl, '_blank')}
                          >
                            View in Dropbox
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}