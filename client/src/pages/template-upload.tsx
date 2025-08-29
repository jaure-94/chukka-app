import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SingleFileUpload } from "@/components/single-file-upload";
import { DataPreview } from "@/components/data-preview";
import { SidebarNavigation, MobileNavigation } from "@/components/sidebar-navigation";
import { ShipSelector } from "@/components/ship-selector";
import { CheckCircle, X, Upload, FileSpreadsheet, Settings, Download } from "lucide-react";
import { useSidebar } from "@/contexts/sidebar-context";
import { useShipContext } from "@/contexts/ship-context";
import { useToast } from "@/hooks/use-toast";
import type { UploadResponse } from "@/lib/types";

export default function TemplateUpload() {
  const [, setLocation] = useLocation();
  const [dispatchUpload, setDispatchUpload] = useState<UploadResponse | null>(null);
  const [eodUpload, setEodUpload] = useState<UploadResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessNotification, setShowSuccessNotification] = useState(false);
  const { isCollapsed } = useSidebar();
  const { currentShip, getShipDisplayName } = useShipContext();
  const { toast } = useToast();

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
      // Convert uploaded files to template records using the file information
      const dispatchTemplateData = {
        filename: dispatchUpload.file.filename,
        originalFilename: dispatchUpload.file.originalName,
        filePath: `uploads/${dispatchUpload.file.filename}`,
        shipId: currentShip,
      };

      const eodTemplateData = {
        filename: eodUpload.file.filename,
        originalFilename: eodUpload.file.originalName,
        filePath: `uploads/${eodUpload.file.filename}`,
        shipId: currentShip,
      };

      // Create dispatch template record
      const dispatchResponse = await fetch('/api/templates/dispatch/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dispatchTemplateData),
      });

      if (!dispatchResponse.ok) {
        const errorData = await dispatchResponse.json();
        throw new Error(`Failed to create dispatch template: ${errorData.message || 'Unknown error'}`);
      }

      // Create EOD template record
      const eodResponse = await fetch('/api/templates/eod/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eodTemplateData),
      });

      if (!eodResponse.ok) {
        const errorData = await eodResponse.json();
        throw new Error(`Failed to create EOD template: ${errorData.message || 'Unknown error'}`);
      }

      // Show success notification
      setShowSuccessNotification(true);
      toast({
        title: "Templates Uploaded Successfully",
        description: "Both dispatch and EOD templates have been stored and are now available across the system.",
      });
      
      // Delay navigation to allow user to see the success notification
      setTimeout(() => {
        setLocation('/create-dispatch');
      }, 1500);
    } catch (error) {
      console.error('Error submitting templates:', error);
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "There was an error uploading your templates. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = dispatchUpload && eodUpload;

  return (
    <div className="h-screen bg-gray-50 flex overflow-hidden">
      {/* Fixed Desktop Sidebar */}
      <div className="hidden md:block fixed left-0 top-0 h-full z-10">
        <SidebarNavigation />
      </div>

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col transition-all duration-300 overflow-y-auto ${
        isCollapsed ? 'md:ml-16' : 'md:ml-64'
      }`}>
        {/* Header */}
        <header className="bg-gradient-to-r from-blue-600 to-blue-800 text-white">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="py-12 text-center">
              <div className="flex items-center justify-start mb-6 md:hidden">
                <MobileNavigation />
              </div>
              <h1 className="text-4xl font-bold mb-4">Welcome to Excel Template Manager</h1>
              <p className="text-xl text-blue-100 mb-6 max-w-3xl mx-auto">
                Upload your dispatch and EOD templates to create a powerful workflow system
              </p>
              <div className="bg-blue-500/20 backdrop-blur-sm rounded-lg p-6 max-w-5xl mx-auto border border-blue-400/30">
                <h2 className="text-lg font-semibold mb-3 text-blue-100">How it works:</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 text-sm">
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 bg-blue-400 rounded-full flex items-center justify-center mb-3">
                      <Upload className="w-6 h-6" />
                    </div>
                    <h3 className="font-medium mb-2">Upload Templates</h3>
                    <p className="text-blue-200 text-center">Upload your dispatch file and EOD template to store them securely</p>
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 bg-blue-400 rounded-full flex items-center justify-center mb-3">
                      <FileSpreadsheet className="w-6 h-6" />
                    </div>
                    <h3 className="font-medium mb-2">Create Records</h3>
                    <p className="text-blue-200 text-center">Fill out dispatch information on the "Create new dispatch record" page</p>
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 bg-blue-400 rounded-full flex items-center justify-center mb-3">
                      <Settings className="w-6 h-6" />
                    </div>
                    <h3 className="font-medium mb-2">Dynamic Updates</h3>
                    <p className="text-blue-200 text-center">Your templates automatically update with new dispatch data</p>
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 bg-blue-400 rounded-full flex items-center justify-center mb-3">
                      <Download className="w-6 h-6" />
                    </div>
                    <h3 className="font-medium mb-2">Download Multiple Reports</h3>
                    <p className="text-blue-200 text-center">Download up-to-date dispatch sheets and EOD reports</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-12 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            {/* Ship Selector */}
            <div className="mb-8">
              <ShipSelector />
            </div>

            {/* Upload Instructions */}
            <div className="text-center mb-12">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Upload Your Template Files
                {currentShip && (
                  <span className="text-lg font-normal text-blue-600 block mt-2">
                    for {getShipDisplayName(currentShip)}
                  </span>
                )}
              </h2>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                Upload both your dispatch file and EOD template below. These templates will be stored securely 
                and will automatically populate with data from dispatch records you create.
              </p>
            </div>

            {/* Document Upload Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
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
              <div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
                <div className="flex items-center mb-4">
                  <CheckCircle className="w-6 h-6 text-green-600 mr-3" />
                  <h3 className="text-xl font-semibold text-gray-900">Dispatch File Preview</h3>
                </div>
                <p className="text-gray-600 mb-6">
                  Preview of your dispatch template with placeholders that will be populated with actual data
                </p>
                <DataPreview sheets={dispatchUpload.preview.sheets} />
              </div>
            )}

            {/* Submit Section */}
            {canSubmit && currentShip && (
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200 p-8 text-center">
                <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Ready to Store Templates for {getShipDisplayName(currentShip)}</h3>
                <p className="text-gray-600 mb-6">
                  Both files have been uploaded successfully. Submit to store your templates and proceed to dispatch creation.
                </p>
                <Button 
                  onClick={handleSubmitTemplates}
                  disabled={isSubmitting}
                  className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 text-lg font-medium disabled:bg-gray-400"
                >
                  {isSubmitting ? `Storing Templates for ${getShipDisplayName(currentShip)}...` : `Submit and Store Templates for ${getShipDisplayName(currentShip)}`}
                </Button>
              </div>
            )}

            {/* Ship Selection Required */}
            {canSubmit && !currentShip && (
              <div className="bg-yellow-50 rounded-lg border border-yellow-200 p-8 text-center">
                <div className="max-w-md mx-auto">
                  <h3 className="text-xl font-semibold text-yellow-800 mb-4">Ship Selection Required</h3>
                  <p className="text-yellow-700 mb-6">
                    Please select a ship above to continue with template setup. Each ship maintains separate templates and data.
                  </p>
                </div>
              </div>
            )}

            {/* Upload Progress Status */}
            {(dispatchUpload || eodUpload) && !canSubmit && (
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
                  <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mr-3"></div>
                  Upload Progress
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-lg border-2 border-dashed border-gray-200">
                    <div className="flex items-center">
                      <div className={`w-4 h-4 rounded-full mr-3 ${
                        dispatchUpload ? 'bg-green-500' : 'bg-gray-300'
                      }`}></div>
                      <span className="font-medium text-gray-700">Dispatch File</span>
                    </div>
                    <span className={`text-sm font-medium px-3 py-1 rounded-full ${
                      dispatchUpload 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {dispatchUpload ? 'Uploaded' : 'Pending'}
                    </span>
                  </div>
              
              <div className="flex items-center justify-between p-4 rounded-lg border-2 border-dashed border-gray-200">
                <div className="flex items-center">
                  <div className={`w-4 h-4 rounded-full mr-3 ${
                    eodUpload ? 'bg-green-500' : 'bg-gray-300'
                  }`}></div>
                  <span className="font-medium text-gray-700">EOD Template</span>
                </div>
                <span className={`text-sm font-medium px-3 py-1 rounded-full ${
                  eodUpload 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {eodUpload ? 'Uploaded' : 'Pending'}
                </span>
              </div>
            </div>
            
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                Please upload both files to proceed. Once uploaded, your templates will be stored and ready for dynamic dispatch record creation.
              </p>
            </div>
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
          </div>
        </main>
      </div>
    </div>
  );
}