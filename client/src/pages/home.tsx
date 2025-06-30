import { useState } from "react";
import { SingleFileUpload } from "@/components/single-file-upload";
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
  const [dispatchUpload, setDispatchUpload] = useState<UploadResponse | null>(null);
  const [eodUpload, setEodUpload] = useState<UploadResponse | null>(null);
  const [currentJob, setCurrentJob] = useState<ProcessingJob | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("employee-report");
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileUploaded = (response: UploadResponse, fileType: 'dispatch' | 'eod') => {
    if (fileType === 'dispatch') {
      setDispatchUpload(response);
    } else {
      setEodUpload(response);
    }
    setCurrentJob(null);
  };

  const handleStartProcessing = async () => {
    if (!dispatchUpload && !eodUpload) return;

    setIsProcessing(true);
    try {
      const response = await fetch("/api/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          fileId: (dispatchUpload || eodUpload)?.file.id,
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
    setDispatchUpload(null);
    setEodUpload(null);
    setCurrentJob(null);
    setIsProcessing(false);
  };

  const handleFileReset = (fileType: 'dispatch' | 'eod') => {
    if (fileType === 'dispatch') {
      setDispatchUpload(null);
    } else {
      setEodUpload(null);
    }
    setCurrentJob(null);
    setIsProcessing(false);
  };

  const getCurrentStep = () => {
    const hasAnyUpload = dispatchUpload || eodUpload;
    
    // Step 0: Document Upload
    if (!hasAnyUpload) return 0;
    
    // Step 1: Data Preview (file uploaded, showing preview)
    if (hasAnyUpload && !currentJob) return 1;
    
    // Step 2: Template Selection (template selected, job created but not started)
    if (currentJob && currentJob.status === "pending") return 2;
    
    // Step 3: Report Generation (processing)
    if (currentJob && currentJob.status === "processing") return 3;
    
    // Step 4: Export (completed)
    if (currentJob && currentJob.status === "completed") return 4;
    
    return 0;
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
        <div className="mb-16">
          <ProcessingStepper currentStep={getCurrentStep()} />
        </div>

        {/* Step 1: Document Upload */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <SingleFileUpload 
            title="Upload Dispatch Excel File"
            fileType="dispatch"
            onFileUploaded={handleFileUploaded} 
            onReset={() => handleFileReset('dispatch')} 
          />
          <SingleFileUpload 
            title="Upload EOD Report Excel File"
            fileType="eod"
            onFileUploaded={handleFileUploaded} 
            onReset={() => handleFileReset('eod')} 
          />
        </div>

        {/* Step 2: Data Preview */}
        {(dispatchUpload || eodUpload) && (
          <div className="mt-8 space-y-6">
            {dispatchUpload && (
              <div>
                <h3 className="text-lg font-semibold mb-4">Dispatch File Preview</h3>
                <DataPreview sheets={dispatchUpload.preview.sheets} />
              </div>
            )}
            {eodUpload && (
              <div>
                <h3 className="text-lg font-semibold mb-4">EOD Report Preview</h3>
                <DataPreview sheets={eodUpload.preview.sheets} />
              </div>
            )}
          </div>
        )}

        {/* Step 3: Template Selection */}
        {(dispatchUpload || eodUpload) && (
          <div className="mt-8 space-y-6">
            <TemplateSelector 
              selectedTemplate={selectedTemplate} 
              onTemplateChange={setSelectedTemplate}
              disabled={isProcessing}
            />
          </div>
        )}

        {/* Processing Status and Export Settings */}
        {(dispatchUpload || eodUpload) && (
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
            <ProcessingStatus 
              job={currentJob} 
              isProcessing={isProcessing} 
              uploadResponse={dispatchUpload || eodUpload} 
            />
            <ExportSettings />
          </div>
        )}

        {/* Processing Actions */}
        {(dispatchUpload || eodUpload) && (
          <div className="mt-8">
            <Card>
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {currentJob?.status === "completed" ? "Report Generated" : "Ready to Generate"}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {currentJob?.status === "completed" 
                        ? "Your report has been generated successfully." 
                        : "File uploaded and validated. Click generate to create your report."}
                    </p>
                  </div>
                  <div className="flex space-x-3">
                    <Button variant="outline" onClick={handleReset}>
                      Reset
                    </Button>
                    {currentJob?.status !== "completed" && (
                      <Button 
                        onClick={handleStartProcessing}
                        disabled={isProcessing || (!dispatchUpload && !eodUpload)}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        {isProcessing ? "Generating..." : "Generate Report"}
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
