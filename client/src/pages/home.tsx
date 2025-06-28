import { useState } from "react";
import { FileUpload } from "@/components/file-upload";
import { DataPreview } from "@/components/data-preview";
import { ProcessingStepper } from "@/components/processing-stepper";
import { ProcessingStatus } from "@/components/processing-status";
import { TemplateSelector } from "@/components/template-selector";
import { ExportSettings } from "@/components/export-settings";
import { ResultsSection } from "@/components/results-section";
import { ProcessingHistory } from "@/components/processing-history";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FileSpreadsheet, Database } from "lucide-react";
import type { UploadResponse, ProcessingJob } from "@/lib/types";

export default function Home() {
  const [uploadResponse, setUploadResponse] = useState<UploadResponse | null>(null);
  const [currentJob, setCurrentJob] = useState<ProcessingJob | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("employee-report");
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileUploaded = (response: UploadResponse) => {
    setUploadResponse(response);
    setCurrentJob(null);
  };

  const handleStartProcessing = async () => {
    if (!uploadResponse) return;

    setIsProcessing(true);
    try {
      const response = await fetch("/api/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          fileId: uploadResponse.file.id,
          templateType: selectedTemplate,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to start processing");
      }

      const { jobId } = await response.json();
      
      // Poll for job status
      const pollInterval = setInterval(async () => {
        try {
          const statusResponse = await fetch(`/api/process/${jobId}`, {
            credentials: "include",
          });
          
          if (statusResponse.ok) {
            const job = await statusResponse.json();
            setCurrentJob(job);
            
            if (job.status === "completed" || job.status === "failed") {
              clearInterval(pollInterval);
              setIsProcessing(false);
            }
          }
        } catch (error) {
          console.error("Failed to check status:", error);
        }
      }, 2000);

    } catch (error) {
      console.error("Processing failed:", error);
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setUploadResponse(null);
    setCurrentJob(null);
    setIsProcessing(false);
  };

  const handleFileReset = () => {
    setUploadResponse(null);
    setCurrentJob(null);
    setIsProcessing(false);
  };

  const getCurrentStep = () => {
    if (!uploadResponse) return 0;
    if (!currentJob || currentJob.status === "pending") return 1;
    if (currentJob.status === "processing" && currentJob.progress < 40) return 2;
    if (currentJob.status === "processing" && currentJob.progress < 80) return 3;
    if (currentJob.status === "processing" || currentJob.status === "completed") return 4;
    return 1;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <FileSpreadsheet className="h-8 w-8 text-blue-600 mr-3" />
              <h1 className="text-xl font-semibold text-gray-900">Excel Data Processor</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">Connected to Database</span>
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Processing Stepper */}
        <div className="mb-12">
          <ProcessingStepper currentStep={getCurrentStep()} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* File Upload and Data Preview */}
          <div className="lg:col-span-2 space-y-6">
            <FileUpload onFileUploaded={handleFileUploaded} onReset={handleFileReset} />
            
            {uploadResponse && (
              <DataPreview sheets={uploadResponse.preview.sheets} />
            )}
          </div>

          {/* Processing Panel */}
          <div className="lg:col-span-1 space-y-6">
            <ProcessingStatus job={currentJob} isProcessing={isProcessing} />
            <TemplateSelector 
              selectedTemplate={selectedTemplate} 
              onTemplateChange={setSelectedTemplate}
              disabled={isProcessing}
            />
            <ExportSettings />
          </div>
        </div>

        {/* Processing Actions */}
        {uploadResponse && (
          <div className="mt-8">
            <Card>
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {currentJob?.status === "completed" ? "Processing Complete" : "Ready to Process"}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {currentJob?.status === "completed" 
                        ? "Your file has been processed successfully." 
                        : "File uploaded and validated. Click start to begin processing."}
                    </p>
                  </div>
                  <div className="flex space-x-3">
                    <Button variant="outline" onClick={handleReset}>
                      Reset
                    </Button>
                    {currentJob?.status !== "completed" && (
                      <Button 
                        onClick={handleStartProcessing}
                        disabled={isProcessing || !uploadResponse}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        {isProcessing ? "Processing..." : "Start Processing"}
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Results Section */}
        {currentJob?.status === "completed" && (
          <div className="mt-8">
            <ResultsSection job={currentJob} />
          </div>
        )}

        {/* Processing History */}
        <div className="mt-8">
          <ProcessingHistory />
        </div>
      </main>
    </div>
  );
}
