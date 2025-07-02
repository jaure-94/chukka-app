import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SingleFileUpload } from "@/components/single-file-upload";
import { DataPreview } from "@/components/data-preview";
import { CheckCircle, X } from "lucide-react";
import type { UploadResponse } from "@/lib/types";

export default function TemplateUpload() {
  const [, setLocation] = useLocation();
  const [dispatchUpload, setDispatchUpload] = useState<UploadResponse | null>(null);
  const [eodUpload, setEodUpload] = useState<UploadResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessNotification, setShowSuccessNotification] = useState(false);

  // Auto-hide success notification after 3 seconds
  useEffect(() => {
    if (showSuccessNotification) {
      const timer = setTimeout(() => {
        setShowSuccessNotification(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [showSuccessNotification]);

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
      
      // Show success notification
      setShowSuccessNotification(true);
      
      // Delay navigation to allow user to see the success notification
      setTimeout(() => {
        setLocation('/create-dispatch');
      }, 1500);
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
          </div>
        )}

        {/* Submit and Store Templates Button - Only show when both files uploaded */}
        {canSubmit && (
          <div className="mt-8 flex justify-center">
            <Button 
              onClick={handleSubmitTemplates}
              disabled={isSubmitting}
              className="bg-green-600 hover:bg-green-700 text-white px-8 py-2 disabled:bg-gray-400"
            >
              {isSubmitting ? "Submitting..." : "Submit and Store Templates"}
            </Button>
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

        {/* Success Notification */}
        <div className={`fixed top-4 right-4 z-50 transform transition-all duration-500 ease-out ${
          showSuccessNotification 
            ? 'translate-x-0 opacity-100 scale-100' 
            : 'translate-x-full opacity-0 scale-95'
        }`}>
          {showSuccessNotification && (
            <div className="bg-green-600 text-white px-6 py-4 rounded-lg shadow-2xl flex items-center space-x-3 min-w-[320px] border border-green-500">
              <div className="bg-green-500 rounded-full p-1">
                <CheckCircle className="w-5 h-5 flex-shrink-0" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-white">Templates Stored Successfully!</h4>
                <p className="text-sm text-green-100 mt-1">Redirecting to dispatch creation page...</p>
              </div>
              <button
                onClick={() => setShowSuccessNotification(false)}
                className="text-green-200 hover:text-white transition-colors duration-200 p-1 rounded-full hover:bg-green-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}