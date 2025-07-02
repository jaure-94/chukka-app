import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileSpreadsheet, CheckCircle, XCircle, Loader2 } from "lucide-react";

interface TemplateStatus {
  dispatch: any;
  eod: any;
  hasTemplates: boolean;
}

export function TemplateSetup() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [uploadingDispatch, setUploadingDispatch] = useState(false);
  const [uploadingEod, setUploadingEod] = useState(false);

  const { data: templateStatus, isLoading } = useQuery<TemplateStatus>({
    queryKey: ["/api/templates/status"],
    queryFn: async () => {
      const response = await fetch("/api/templates/status");
      if (!response.ok) throw new Error("Failed to fetch template status");
      return response.json();
    },
  });

  const uploadTemplate = async (file: File, type: 'dispatch' | 'eod') => {
    const formData = new FormData();
    formData.append('template', file);

    const response = await fetch(`/api/templates/${type}`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Failed to upload ${type} template`);
    }

    return response.json();
  };

  const uploadDispatchMutation = useMutation({
    mutationFn: (file: File) => uploadTemplate(file, 'dispatch'),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Dispatch template uploaded successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/templates/status"] });
      setUploadingDispatch(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to upload dispatch template",
        variant: "destructive",
      });
      console.error("Upload error:", error);
      setUploadingDispatch(false);
    },
  });

  const uploadEodMutation = useMutation({
    mutationFn: (file: File) => uploadTemplate(file, 'eod'),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "EOD template uploaded successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/templates/status"] });
      setUploadingEod(false);
    },
    onError: (error) => {
      toast({
        title: "Error", 
        description: "Failed to upload EOD template",
        variant: "destructive",
      });
      console.error("Upload error:", error);
      setUploadingEod(false);
    },
  });

  const handleFileUpload = (file: File, type: 'dispatch' | 'eod') => {
    if (type === 'dispatch') {
      setUploadingDispatch(true);
      uploadDispatchMutation.mutate(file);
    } else {
      setUploadingEod(true);
      uploadEodMutation.mutate(file);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>, type: 'dispatch' | 'eod') => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileUpload(file, type);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Template Setup</CardTitle>
          <CardDescription>Loading template status...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Template Setup
        </CardTitle>
        <CardDescription>
          Upload your dispatch and EOD Excel templates. These will be used to generate reports from manual entries.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Template Status Overview */}
        <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
          <div className="flex items-center gap-2">
            {templateStatus?.hasTemplates ? (
              <CheckCircle className="h-5 w-5 text-green-600" />
            ) : (
              <XCircle className="h-5 w-5 text-red-600" />
            )}
            <span className="font-medium">
              {templateStatus?.hasTemplates ? "Templates Ready" : "Templates Required"}
            </span>
          </div>
          {templateStatus?.hasTemplates && (
            <Badge variant="secondary">Ready for manual entry</Badge>
          )}
        </div>

        {/* Dispatch Template Upload */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">Dispatch Template</h3>
              <p className="text-sm text-muted-foreground">
                Upload your dispatch Excel template file
              </p>
            </div>
            <div className="flex items-center gap-2">
              {templateStatus?.dispatch ? (
                <Badge variant="default">Uploaded</Badge>
              ) : (
                <Badge variant="outline">Missing</Badge>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => handleFileChange(e, 'dispatch')}
              className="hidden"
              id="dispatch-upload"
              disabled={uploadingDispatch}
            />
            <label htmlFor="dispatch-upload">
              <Button
                variant="outline"
                disabled={uploadingDispatch}
                className="cursor-pointer"
                asChild
              >
                <span>
                  {uploadingDispatch ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      {templateStatus?.dispatch ? "Replace" : "Upload"} Dispatch Template
                    </>
                  )}
                </span>
              </Button>
            </label>
            {templateStatus?.dispatch && (
              <span className="text-sm text-muted-foreground">
                {templateStatus.dispatch.originalFilename}
              </span>
            )}
          </div>
        </div>

        {/* EOD Template Upload */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">EOD Template</h3>
              <p className="text-sm text-muted-foreground">
                Upload your EOD Excel template file
              </p>
            </div>
            <div className="flex items-center gap-2">
              {templateStatus?.eod ? (
                <Badge variant="default">Uploaded</Badge>
              ) : (
                <Badge variant="outline">Missing</Badge>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => handleFileChange(e, 'eod')}
              className="hidden"
              id="eod-upload"
              disabled={uploadingEod}
            />
            <label htmlFor="eod-upload">
              <Button
                variant="outline"
                disabled={uploadingEod}
                className="cursor-pointer"
                asChild
              >
                <span>
                  {uploadingEod ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      {templateStatus?.eod ? "Replace" : "Upload"} EOD Template
                    </>
                  )}
                </span>
              </Button>
            </label>
            {templateStatus?.eod && (
              <span className="text-sm text-muted-foreground">
                {templateStatus.eod.originalFilename}
              </span>
            )}
          </div>
        </div>

        {!templateStatus?.hasTemplates && (
          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              Both templates are required before you can start adding dispatch records manually.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}