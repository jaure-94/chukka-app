import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Upload, Download, ChevronRight } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSidebar } from "@/contexts/sidebar-context";
import { useShipContext } from "@/contexts/ship-context";
import { useToast } from "@/hooks/use-toast";
import { Link, useLocation, useParams } from "wouter";
import { SidebarNavigation, MobileNavigation } from "@/components/sidebar-navigation";
import { Breadcrumbs } from "@/components/breadcrumbs";

interface Template {
  id: number;
  filename: string;
  originalFilename: string;
  filePath: string;
  createdAt: string;
  isActive: boolean;
}

interface FileUpload {
  file: File;
  preview: string;
}

export default function EditTemplatesPage() {
  const { isCollapsed } = useSidebar();
  const { setCurrentShip, getShipDisplayName } = useShipContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const params = useParams();
  
  // Extract ship from URL params (/templates/edit/ship-a)
  const shipFromUrl = params.ship as string;
  const currentShip = (shipFromUrl || 'ship-a') as 'ship-a' | 'ship-b' | 'ship-c';
  
  // Update ship context when URL changes
  React.useEffect(() => {
    if (shipFromUrl && ['ship-a', 'ship-b', 'ship-c'].includes(shipFromUrl)) {
      setCurrentShip(shipFromUrl as 'ship-a' | 'ship-b' | 'ship-c');
    }
  }, [shipFromUrl, setCurrentShip]);
  
  const [dispatchUpload, setDispatchUpload] = useState<FileUpload | null>(null);
  const [eodUpload, setEodUpload] = useState<FileUpload | null>(null);
  const [paxUpload, setPaxUpload] = useState<FileUpload | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch current templates for the specific ship
  const { data: dispatchTemplate, isLoading: dispatchLoading } = useQuery<Template | null>({
    queryKey: ['/api/dispatch-templates', currentShip],
    queryFn: async () => {
      const res = await fetch(`/api/dispatch-templates?ship=${currentShip}`);
      const data = await res.json();
      return Object.keys(data).length === 0 ? null : data;
    },
    enabled: !!currentShip,
  });

  const { data: eodTemplate, isLoading: eodLoading } = useQuery<Template | null>({
    queryKey: ['/api/eod-templates', currentShip],
    queryFn: async () => {
      const res = await fetch(`/api/eod-templates?ship=${currentShip}`);
      const data = await res.json();
      return Object.keys(data).length === 0 ? null : data;
    },
    enabled: !!currentShip,
  });

  const { data: paxTemplate, isLoading: paxLoading } = useQuery<Template | null>({
    queryKey: ['/api/pax-templates', currentShip],
    queryFn: async () => {
      const res = await fetch(`/api/pax-templates?ship=${currentShip}`);
      const data = await res.json();
      return Object.keys(data).length === 0 ? null : data;
    },
    enabled: !!currentShip,
  });

  const handleFileUpload = (file: File, type: 'dispatch' | 'eod' | 'pax') => {
    const upload: FileUpload = {
      file,
      preview: file.name
    };
    
    if (type === 'dispatch') {
      setDispatchUpload(upload);
    } else if (type === 'eod') {
      setEodUpload(upload);
    } else {
      setPaxUpload(upload);
    }
  };

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>, type: 'dispatch' | 'eod' | 'pax') => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileUpload(file, type);
    }
  };

  const downloadTemplate = async (template: Template) => {
    try {
      let endpoint = `/api/templates/eod/download?ship=${currentShip}`; // default
      if (template.id === dispatchTemplate?.id) {
        endpoint = `/api/templates/dispatch/download?ship=${currentShip}`;
      } else if (template.id === paxTemplate?.id) {
        endpoint = `/api/templates/pax/download?ship=${currentShip}`;
      }
      
      const response = await fetch(endpoint);
      if (!response.ok) throw new Error('Download failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = template.originalFilename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Download Complete",
        description: `${template.originalFilename} has been downloaded successfully.`,
      });
    } catch (error) {
      toast({
        title: "Download Failed",
        description: "There was an error downloading the template.",
        variant: "destructive",
      });
    }
  };

  const saveAndReplaceTemplates = async () => {
    if (!dispatchUpload && !eodUpload && !paxUpload) {
      toast({
        title: "No Changes",
        description: "Please select at least one template to replace.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Upload new files if selected
      if (dispatchUpload) {
        const formData = new FormData();
        formData.append('template', dispatchUpload.file);
        formData.append('shipId', currentShip);
        
        const templateResponse = await fetch('/api/templates/dispatch', {
          method: 'POST',
          body: formData,
        });
        
        if (!templateResponse.ok) throw new Error('Failed to upload dispatch template');
      }
      
      if (eodUpload) {
        const formData = new FormData();
        formData.append('template', eodUpload.file);
        formData.append('shipId', currentShip);
        
        const templateResponse = await fetch('/api/templates/eod', {
          method: 'POST',
          body: formData,
        });
        
        if (!templateResponse.ok) throw new Error('Failed to upload EOD template');
      }

      if (paxUpload) {
        const formData = new FormData();
        formData.append('template', paxUpload.file);
        formData.append('shipId', currentShip);
        
        const templateResponse = await fetch('/api/templates/pax', {
          method: 'POST',
          body: formData,
        });
        
        if (!templateResponse.ok) throw new Error('Failed to upload PAX template');
      }
      
      // Invalidate cache to refresh data for the specific ship
      await queryClient.invalidateQueries({ queryKey: ['/api/dispatch-templates', currentShip] });
      await queryClient.invalidateQueries({ queryKey: ['/api/eod-templates', currentShip] });
      await queryClient.invalidateQueries({ queryKey: ['/api/pax-templates', currentShip] });
      
      toast({
        title: "Templates Updated",
        description: "Your templates have been successfully replaced.",
      });
      
      // Reset upload states
      setDispatchUpload(null);
      setEodUpload(null);
      setPaxUpload(null);
      
      // Redirect back to Templates page after a short delay to show the success message
      setTimeout(() => {
        setLocation(`/templates/${currentShip}`);
      }, 1500);
      
    } catch (error) {
      toast({
        title: "Update Failed",
        description: "There was an error updating your templates. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (dispatchLoading || eodLoading || paxLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex">
        <div className="hidden md:block fixed left-0 top-0 h-full z-10">
          <SidebarNavigation />
        </div>
        <div className={`flex-1 flex items-center justify-center transition-all duration-300 ${
          isCollapsed ? 'md:ml-16' : 'md:ml-64'
        }`}>
          <div className="text-center px-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-sm sm:text-base text-gray-600">Loading templates...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Fixed Desktop Sidebar */}
      <div className="hidden md:block fixed left-0 top-0 h-full z-10">
        <SidebarNavigation />
      </div>

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col transition-all duration-300 ${
        isCollapsed ? 'md:ml-16' : 'md:ml-64'
      }`}>
        {/* Mobile Header with Navigation */}
        <header className="bg-white border-b border-gray-200 md:hidden sticky top-0 z-20">
          <div className="px-3 sm:px-4 py-2 sm:py-3">
            <div className="flex items-center gap-3">
              <MobileNavigation />
              <div className="flex-1 min-w-0">
                <h1 className="text-base sm:text-lg font-bold text-gray-900 truncate">
                  Edit Templates
                </h1>
                <p className="text-xs sm:text-sm text-blue-600 truncate">
                  {getShipDisplayName(currentShip)}
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Breadcrumbs - Mobile Optimized */}
        <Breadcrumbs />

        {/* Header - Desktop Only */}
        <header className="bg-white shadow-sm border-b hidden md:block">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="py-6">
              <div className="flex items-center">
                <MobileNavigation />
                <div className="ml-4 md:ml-0">
                  <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Edit Templates - {getShipDisplayName(currentShip)}</h1>
                  <p className="text-sm sm:text-base text-gray-600">
                    Replace your current templates with new versions for {getShipDisplayName(currentShip)}. Select new files to upload and save changes.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 max-w-7xl mx-auto w-full px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5 md:gap-6 mb-6 sm:mb-8">
            {/* Dispatch Template */}
            <Card className="border-2 border-blue-200 hover:shadow-lg active:shadow-md transition-all duration-200 touch-manipulation">
              <CardHeader className="px-3 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4">
                <CardTitle className="flex items-center gap-2 text-blue-700 text-base sm:text-lg">
                  <FileText className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                  <span>Dispatch Template</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 sm:px-6 pb-4 sm:pb-6">
                <div className="space-y-3 sm:space-y-4">
                  {dispatchTemplate && (
                    <div className="bg-blue-50 p-3 sm:p-4 rounded-lg">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2 mb-2">
                        <span className="text-xs sm:text-sm font-medium text-blue-700">Current Template:</span>
                        <Badge variant="default" className="bg-blue-100 text-blue-800 text-xs w-fit sm:w-auto">
                          Active
                        </Badge>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2 mb-2">
                        <span className="text-xs sm:text-sm font-medium text-blue-700">Filename:</span>
                        <span className="text-xs sm:text-sm text-blue-600 break-words sm:truncate sm:max-w-48 text-right sm:text-left">
                          {dispatchTemplate.originalFilename}
                        </span>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2 mb-3">
                        <span className="text-xs sm:text-sm font-medium text-blue-700">Uploaded:</span>
                        <span className="text-xs sm:text-sm text-blue-600 text-right sm:text-left">
                          {new Date(dispatchTemplate.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <Button
                        onClick={() => downloadTemplate(dispatchTemplate)}
                        variant="outline"
                        size="sm"
                        className="w-full h-10 sm:h-11 text-xs sm:text-sm touch-manipulation"
                      >
                        <Download className="w-3 h-3 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
                        Download Current
                      </Button>
                    </div>
                  )}
                  
                  <div className="border-2 border-dashed border-blue-300 rounded-lg p-4 sm:p-6 text-center">
                    {dispatchUpload ? (
                      <div className="space-y-2 sm:space-y-3">
                        <FileText className="w-10 h-10 sm:w-12 sm:h-12 text-blue-500 mx-auto" />
                        <p className="text-xs sm:text-sm font-medium text-blue-700 break-words px-2">
                          New file selected: {dispatchUpload.preview}
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDispatchUpload(null)}
                          className="h-9 sm:h-10 text-xs sm:text-sm touch-manipulation"
                        >
                          Clear Selection
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2 sm:space-y-3">
                        <Upload className="w-10 h-10 sm:w-12 sm:h-12 text-blue-400 mx-auto" />
                        <p className="text-xs sm:text-sm text-blue-600 px-2">
                          Select a new dispatch template file
                        </p>
                        <label className="block cursor-pointer">
                          <input
                            type="file"
                            accept=".xlsx,.xls"
                            onChange={(e) => handleFileInputChange(e, 'dispatch')}
                            className="hidden"
                          />
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="cursor-pointer h-9 sm:h-10 text-xs sm:text-sm touch-manipulation" 
                            asChild
                          >
                            <span>Replace Document</span>
                          </Button>
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* EOD Template */}
            <Card className="border-2 border-green-200 hover:shadow-lg active:shadow-md transition-all duration-200 touch-manipulation">
              <CardHeader className="px-3 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4">
                <CardTitle className="flex items-center gap-2 text-green-700 text-base sm:text-lg">
                  <FileText className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                  <span>EOD Template</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 sm:px-6 pb-4 sm:pb-6">
                <div className="space-y-3 sm:space-y-4">
                  {eodTemplate && (
                    <div className="bg-green-50 p-3 sm:p-4 rounded-lg">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2 mb-2">
                        <span className="text-xs sm:text-sm font-medium text-green-700">Current Template:</span>
                        <Badge variant="default" className="bg-green-100 text-green-800 text-xs w-fit sm:w-auto">
                          Active
                        </Badge>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2 mb-2">
                        <span className="text-xs sm:text-sm font-medium text-green-700">Filename:</span>
                        <span className="text-xs sm:text-sm text-green-600 break-words sm:truncate sm:max-w-48 text-right sm:text-left">
                          {eodTemplate.originalFilename}
                        </span>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2 mb-3">
                        <span className="text-xs sm:text-sm font-medium text-green-700">Uploaded:</span>
                        <span className="text-xs sm:text-sm text-green-600 text-right sm:text-left">
                          {new Date(eodTemplate.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <Button
                        onClick={() => downloadTemplate(eodTemplate)}
                        variant="outline"
                        size="sm"
                        className="w-full h-10 sm:h-11 text-xs sm:text-sm touch-manipulation"
                      >
                        <Download className="w-3 h-3 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
                        Download Current
                      </Button>
                    </div>
                  )}
                  
                  <div className="border-2 border-dashed border-green-300 rounded-lg p-4 sm:p-6 text-center">
                    {eodUpload ? (
                      <div className="space-y-2 sm:space-y-3">
                        <FileText className="w-10 h-10 sm:w-12 sm:h-12 text-green-500 mx-auto" />
                        <p className="text-xs sm:text-sm font-medium text-green-700 break-words px-2">
                          New file selected: {eodUpload.preview}
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEodUpload(null)}
                          className="h-9 sm:h-10 text-xs sm:text-sm touch-manipulation"
                        >
                          Clear Selection
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2 sm:space-y-3">
                        <Upload className="w-10 h-10 sm:w-12 sm:h-12 text-green-400 mx-auto" />
                        <p className="text-xs sm:text-sm text-green-600 px-2">
                          Select a new EOD template file
                        </p>
                        <label className="block cursor-pointer">
                          <input
                            type="file"
                            accept=".xlsx,.xls"
                            onChange={(e) => handleFileInputChange(e, 'eod')}
                            className="hidden"
                          />
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="cursor-pointer h-9 sm:h-10 text-xs sm:text-sm touch-manipulation" 
                            asChild
                          >
                            <span>Replace Document</span>
                          </Button>
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* PAX Report Template */}
            <Card className="border-2 border-purple-200 hover:shadow-lg active:shadow-md transition-all duration-200 touch-manipulation">
              <CardHeader className="px-3 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4">
                <CardTitle className="flex items-center gap-2 text-purple-700 text-base sm:text-lg">
                  <FileText className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                  <span>PAX Report Template</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 sm:px-6 pb-4 sm:pb-6">
                <div className="space-y-3 sm:space-y-4">
                  {paxTemplate && (
                    <div className="bg-purple-50 p-3 sm:p-4 rounded-lg">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2 mb-2">
                        <span className="text-xs sm:text-sm font-medium text-purple-700">Current Template:</span>
                        <Badge variant="default" className="bg-purple-100 text-purple-800 text-xs w-fit sm:w-auto">
                          Active
                        </Badge>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2 mb-2">
                        <span className="text-xs sm:text-sm font-medium text-purple-700">Filename:</span>
                        <span className="text-xs sm:text-sm text-purple-600 break-words sm:truncate sm:max-w-48 text-right sm:text-left">
                          {paxTemplate.originalFilename}
                        </span>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2 mb-3">
                        <span className="text-xs sm:text-sm font-medium text-purple-700">Uploaded:</span>
                        <span className="text-xs sm:text-sm text-purple-600 text-right sm:text-left">
                          {new Date(paxTemplate.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <Button
                        onClick={() => downloadTemplate(paxTemplate)}
                        variant="outline"
                        size="sm"
                        className="w-full h-10 sm:h-11 text-xs sm:text-sm touch-manipulation"
                      >
                        <Download className="w-3 h-3 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
                        Download Current
                      </Button>
                    </div>
                  )}
                  
                  <div className="border-2 border-dashed border-purple-300 rounded-lg p-4 sm:p-6 text-center">
                    {paxUpload ? (
                      <div className="space-y-2 sm:space-y-3">
                        <FileText className="w-10 h-10 sm:w-12 sm:h-12 text-purple-500 mx-auto" />
                        <p className="text-xs sm:text-sm font-medium text-purple-700 break-words px-2">
                          New file selected: {paxUpload.preview}
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPaxUpload(null)}
                          className="h-9 sm:h-10 text-xs sm:text-sm touch-manipulation"
                        >
                          Clear Selection
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2 sm:space-y-3">
                        <Upload className="w-10 h-10 sm:w-12 sm:h-12 text-purple-400 mx-auto" />
                        <p className="text-xs sm:text-sm text-purple-600 px-2">
                          Select a new PAX report template file
                        </p>
                        <label className="block cursor-pointer">
                          <input
                            type="file"
                            accept=".xlsx,.xls"
                            onChange={(e) => handleFileInputChange(e, 'pax')}
                            className="hidden"
                          />
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="cursor-pointer h-9 sm:h-10 text-xs sm:text-sm touch-manipulation" 
                            asChild
                          >
                            <span>Replace Document</span>
                          </Button>
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Save Button - Sticky on Mobile */}
          <div className="sticky bottom-0 bg-gray-50 pt-4 sm:pt-6 pb-3 sm:pb-4 md:pb-0 md:bg-transparent md:static md:flex md:justify-center -mx-3 sm:-mx-4 md:mx-0 px-3 sm:px-4 md:px-0 border-t md:border-t-0 border-gray-200 md:border-0 mt-4 sm:mt-6 md:mt-0">
            <Button
              onClick={saveAndReplaceTemplates}
              disabled={isSubmitting || (!dispatchUpload && !eodUpload && !paxUpload)}
              size="lg"
              className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white px-6 sm:px-8 h-12 sm:h-14 text-sm sm:text-base touch-manipulation shadow-lg md:shadow-none"
            >
              {isSubmitting ? (
                <>
                  <Upload className="w-4 h-4 sm:w-5 sm:h-5 mr-2 animate-spin" />
                  <span>Saving Templates...</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                  <span className="hidden sm:inline">Save and Replace Templates</span>
                  <span className="sm:hidden">Save Templates</span>
                </>
              )}
            </Button>
          </div>
        </main>
      </div>
    </div>
  );
}