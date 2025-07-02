import { useQuery } from "@tanstack/react-query";
import { TemplateSetup } from "@/components/template-setup";
import { DispatchForm } from "@/components/dispatch-form";
import { DispatchRecordsList } from "@/components/dispatch-records-list";
import { GeneratedReports } from "@/components/generated-reports";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { PlusCircle, FileText, AlertCircle } from "lucide-react";

interface TemplateStatus {
  hasTemplates: boolean;
  dispatch: any;
  eod: any;
}

export function ManualDispatch() {
  const { data: templateStatus } = useQuery<TemplateStatus>({
    queryKey: ["/api/templates/status"],
    queryFn: async () => {
      const response = await fetch("/api/templates/status");
      if (!response.ok) throw new Error("Failed to fetch template status");
      return response.json();
    },
  });

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Page Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <PlusCircle className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Manual Dispatch Entry</h1>
          {templateStatus?.hasTemplates && (
            <Badge variant="default" className="ml-2">Ready</Badge>
          )}
        </div>
        <p className="text-muted-foreground text-lg">
          Enter dispatch records manually and automatically generate both dispatch and EOD reports
        </p>
      </div>

      {/* Template Setup Section */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          <h2 className="text-xl font-semibold">1. Template Setup</h2>
        </div>
        <TemplateSetup />
      </section>

      <Separator />

      {/* Manual Entry Section */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <PlusCircle className="h-5 w-5" />
          <h2 className="text-xl font-semibold">2. Add Dispatch Records</h2>
        </div>
        
        {!templateStatus?.hasTemplates ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Please upload both dispatch and EOD templates above before adding records.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <DispatchForm />
            <DispatchRecordsList />
          </>
        )}
      </section>

      <Separator />

      {/* Generated Reports Section */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          <h2 className="text-xl font-semibold">3. Download Reports</h2>
        </div>
        
        {!templateStatus?.hasTemplates ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-4">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  Reports will appear here after templates are set up and records are added
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <GeneratedReports />
        )}
      </section>

      {/* How It Works */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">How It Works</h2>
        <Card>
          <CardHeader>
            <CardTitle>Process Overview</CardTitle>
            <CardDescription>
              Understanding the manual dispatch entry workflow
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">1</div>
                  <h3 className="font-medium">Upload Templates</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Upload your dispatch and EOD Excel templates once. These will be stored and reused for all future entries.
                </p>
              </div>
              
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold">2</div>
                  <h3 className="font-medium">Add Records</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Enter tour information manually. Each new record is added to the growing collection and reports are regenerated automatically.
                </p>
              </div>
              
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 bg-purple-600 text-white rounded-full flex items-center justify-center text-sm font-bold">3</div>
                  <h3 className="font-medium">Download Reports</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Download the latest dispatch and EOD reports containing all your entries with proper formatting preserved.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}