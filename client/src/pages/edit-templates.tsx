import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Upload, Download, ChevronRight } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSidebar } from "@/contexts/sidebar-context";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { SidebarNavigation, MobileNavigation } from "@/components/sidebar-navigation";

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
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [dispatchUpload, setDispatchUpload] = useState<FileUpload | null>(null);
  const [eodUpload, setEodUpload] = useState<FileUpload | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch current templates
  const { data: dispatchTemplate, isLoading: dispatchLoading } = useQuery<Template>({
    queryKey: ['/api/dispatch-templates'],
  });

  const { data: eodTemplate, isLoading: eodLoading } = useQuery<Template>({
    queryKey: ['/api/eod-templates'],
  });

  const handleFileUpload = (file: File, type: 'dispatch' | 'eod') => {
    const upload: FileUpload = {
      file,
      preview: file.name
    };
    
    if (type === 'dispatch') {
      setDispatchUpload(upload);
    } else {
      setEodUpload(upload);
    }
  };

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>, type: 'dispatch' | 'eod') => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileUpload(file, type);
    }
  };

  const downloadTemplate = async (template: Template) => {
    try {
      const endpoint = template.id === dispatchTemplate?.id 
        ? '/api/templates/dispatch/download' 
        : '/api/templates/eod/download';
      
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
    if (!dispatchUpload && !eodUpload) {
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
        formData.append('file', dispatchUpload.file);
        
        const uploadResponse = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });
        
        if (!uploadResponse.ok) throw new Error('Failed to upload dispatch file');
        const uploadResult = await uploadResponse.json();
        
        // Create new dispatch template
        const templateData = {
          filename: uploadResult.file.filename,
          originalFilename: uploadResult.file.originalName,
          filePath: `uploads/${uploadResult.file.filename}`,
        };
        
        const templateResponse = await fetch('/api/templates/dispatch/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(templateData),
        });
        
        if (!templateResponse.ok) throw new Error('Failed to create dispatch template');
      }
      
      if (eodUpload) {
        const formData = new FormData();
        formData.append('file', eodUpload.file);
        
        const uploadResponse = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });
        
        if (!uploadResponse.ok) throw new Error('Failed to upload EOD file');
        const uploadResult = await uploadResponse.json();
        
        // Create new EOD template
        const templateData = {
          filename: uploadResult.file.filename,
          originalFilename: uploadResult.file.originalName,
          filePath: `uploads/${uploadResult.file.filename}`,
        };
        
        const templateResponse = await fetch('/api/templates/eod/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(templateData),
        });
        
        if (!templateResponse.ok) throw new Error('Failed to create EOD template');
      }
      
      // Invalidate cache to refresh data
      await queryClient.invalidateQueries({ queryKey: ['/api/dispatch-templates'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/eod-templates'] });
      
      toast({
        title: "Templates Updated",
        description: "Your templates have been successfully replaced.",
      });
      
      // Reset upload states
      setDispatchUpload(null);
      setEodUpload(null);
      
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

  if (dispatchLoading || eodLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex">
        <div className="hidden md:block fixed left-0 top-0 h-full z-10">
          <SidebarNavigation />
        </div>
        <div className={`flex-1 flex items-center justify-center transition-all duration-300 ${
          isCollapsed ? 'md:ml-16' : 'md:ml-64'
        }`}>
          <div className="text-center">Loading templates...</div>
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
        {/* Header */}
        <header className="bg-white shadow-sm border-b">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="py-6">
              <div className="flex items-center">
                <MobileNavigation />
                <div className="ml-4 md:ml-0">
                  {/* Breadcrumb Navigation */}
                  <nav className="flex items-center space-x-2 text-sm text-gray-500 mb-3">
                    <Link href="/templates" className="hover:text-gray-700 transition-colors">
                      Templates
                    </Link>
                    <ChevronRight className="w-4 h-4" />
                    <span className="text-gray-900 font-medium">Edit Templates</span>
                  </nav>
                  
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">Edit Templates</h1>
                  <p className="text-gray-600">
                    Replace your current templates with new versions. Select new files to upload and save changes.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* Dispatch Template */}
            <Card className="border-2 border-blue-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-700">
                  <FileText className="w-5 h-5" />
                  Dispatch Template
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {dispatchTemplate && (
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-blue-700">Current Template:</span>
                        <Badge variant="default" className="bg-blue-100 text-blue-800">
                          Active
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-blue-700">Filename:</span>
                        <span className="text-sm text-blue-600 truncate max-w-48">
                          {dispatchTemplate.originalFilename}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-blue-700">Uploaded:</span>
                        <span className="text-sm text-blue-600">
                          {new Date(dispatchTemplate.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <Button
                        onClick={() => downloadTemplate(dispatchTemplate)}
                        variant="outline"
                        size="sm"
                        className="w-full"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download Current
                      </Button>
                    </div>
                  )}
                  
                  <div className="border-2 border-dashed border-blue-300 rounded-lg p-6 text-center">
                    {dispatchUpload ? (
                      <div className="space-y-3">
                        <FileText className="w-12 h-12 text-blue-500 mx-auto" />
                        <p className="text-sm font-medium text-blue-700">
                          New file selected: {dispatchUpload.preview}
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDispatchUpload(null)}
                        >
                          Clear Selection
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <Upload className="w-12 h-12 text-blue-400 mx-auto" />
                        <p className="text-sm text-blue-600">
                          Select a new dispatch template file
                        </p>
                        <label className="block cursor-pointer">
                          <input
                            type="file"
                            accept=".xlsx,.xls"
                            onChange={(e) => handleFileInputChange(e, 'dispatch')}
                            className="hidden"
                          />
                          <Button variant="outline" size="sm" className="cursor-pointer" asChild>
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
            <Card className="border-2 border-green-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-700">
                  <FileText className="w-5 h-5" />
                  EOD Template
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {eodTemplate && (
                    <div className="bg-green-50 p-4 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-green-700">Current Template:</span>
                        <Badge variant="default" className="bg-green-100 text-green-800">
                          Active
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-green-700">Filename:</span>
                        <span className="text-sm text-green-600 truncate max-w-48">
                          {eodTemplate.originalFilename}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-green-700">Uploaded:</span>
                        <span className="text-sm text-green-600">
                          {new Date(eodTemplate.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <Button
                        onClick={() => downloadTemplate(eodTemplate)}
                        variant="outline"
                        size="sm"
                        className="w-full"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download Current
                      </Button>
                    </div>
                  )}
                  
                  <div className="border-2 border-dashed border-green-300 rounded-lg p-6 text-center">
                    {eodUpload ? (
                      <div className="space-y-3">
                        <FileText className="w-12 h-12 text-green-500 mx-auto" />
                        <p className="text-sm font-medium text-green-700">
                          New file selected: {eodUpload.preview}
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEodUpload(null)}
                        >
                          Clear Selection
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <Upload className="w-12 h-12 text-green-400 mx-auto" />
                        <p className="text-sm text-green-600">
                          Select a new EOD template file
                        </p>
                        <label className="block cursor-pointer">
                          <input
                            type="file"
                            accept=".xlsx,.xls"
                            onChange={(e) => handleFileInputChange(e, 'eod')}
                            className="hidden"
                          />
                          <Button variant="outline" size="sm" className="cursor-pointer" asChild>
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

          {/* Save Button */}
          <div className="flex justify-center">
            <Button
              onClick={saveAndReplaceTemplates}
              disabled={isSubmitting || (!dispatchUpload && !eodUpload)}
              size="lg"
              className="bg-blue-600 hover:bg-blue-700 text-white px-8"
            >
              {isSubmitting ? (
                <>
                  <Upload className="w-4 h-4 mr-2 animate-spin" />
                  Saving Templates...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Save and Replace Templates
                </>
              )}
            </Button>
          </div>
        </main>
      </div>
    </div>
  );
}