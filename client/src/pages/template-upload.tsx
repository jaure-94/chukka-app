import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SingleFileUpload } from "@/components/single-file-upload";
import { DataPreview } from "@/components/data-preview";
import type { UploadResponse } from "@/lib/types";

export default function TemplateUpload() {
  const [, setLocation] = useLocation();
  const [dispatchUpload, setDispatchUpload] = useState<UploadResponse | null>(null);
  const [eodUpload, setEodUpload] = useState<UploadResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFileUploaded = (response: UploadResponse, fileType: 'dispatch' | 'eod') => {
    if (fileType === 'dispatch') {
      setDispatchUpload(response);
    } else if (fileType === 'eod') {
      setEodUpload(response);
    }
  };

  const handleFileReset = (fileType: 'dispatch' | 'eod') => {
    if (fileType === 'dispatch') {
      setDispatchUpload(null);
    } else {
      setEodUpload(null);
    }
  };

  const handleSubmitTemplates = async () => {
    if (!dispatchUpload || !eodUpload) return;
    
    setIsSubmitting(true);
    
    try {
      // Store the template data in sessionStorage for the next page
      sessionStorage.setItem('templateData', JSON.stringify({
        dispatch: dispatchUpload,
        eod: eodUpload
      }));
      
      // Navigate to dispatch creation page
      setLocation('/create-dispatch');
    } catch (error) {
      console.error('Error submitting templates:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = dispatchUpload && eodUpload;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <h1 className="text-3xl font-bold text-gray-900">Excel Template Upload</h1>
            <p className="mt-2 text-gray-600">
              Upload your dispatch file and EOD template to get started
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Document Upload Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <SingleFileUpload 
            title="Upload Dispatch Excel File"
            fileType="dispatch"
            onFileUploaded={handleFileUploaded} 
            onReset={() => handleFileReset('dispatch')} 
          />
          <SingleFileUpload 
            title="Upload EOD Report Excel Template File"
            fileType="eod"
            onFileUploaded={handleFileUploaded} 
            onReset={() => handleFileReset('eod')} 
          />
        </div>

        {/* Data Preview Section */}
        {dispatchUpload && (
          <div className="mt-8 space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-4">Dispatch File Preview</h3>
              <DataPreview sheets={dispatchUpload.preview.sheets} />
            </div>
            
            {/* Submit Templates Button */}
            <div className="flex justify-center mt-6">
              <Button 
                onClick={handleSubmitTemplates}
                disabled={!canSubmit || isSubmitting}
                className="bg-green-600 hover:bg-green-700 text-white px-8 py-2 disabled:bg-gray-400"
              >
                {isSubmitting ? "Submitting..." : "Submit Templates"}
              </Button>
            </div>
          </div>
        )}

        {/* Upload Status */}
        {(dispatchUpload || eodUpload) && (
          <div className="mt-8">
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Upload Status</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Dispatch File:</span>
                    <span className={`text-sm font-medium ${
                      dispatchUpload ? 'text-green-600' : 'text-gray-400'
                    }`}>
                      {dispatchUpload ? '✓ Uploaded' : 'Not uploaded'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">EOD Template:</span>
                    <span className={`text-sm font-medium ${
                      eodUpload ? 'text-green-600' : 'text-gray-400'
                    }`}>
                      {eodUpload ? '✓ Uploaded' : 'Not uploaded'}
                    </span>
                  </div>
                </div>
                
                {canSubmit && (
                  <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
                    <p className="text-sm text-green-800">
                      Both files uploaded successfully! You can now submit your templates.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}