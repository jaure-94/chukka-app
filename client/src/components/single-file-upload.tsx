import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CloudUpload, FileSpreadsheet, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { UploadResponse } from "@/lib/types";

interface SingleFileUploadProps {
  title: string;
  fileType: 'dispatch' | 'eod';
  onFileUploaded: (response: UploadResponse, fileType: 'dispatch' | 'eod') => void;
  onReset?: () => void;
}

export function SingleFileUpload({ title, fileType, onFileUploaded, onReset }: SingleFileUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const { toast } = useToast();

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setIsUploading(true);
    setUploadedFile(file);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const data: UploadResponse = await response.json();
      onFileUploaded(data, fileType);

      toast({
        title: "File uploaded successfully",
        description: `${file.name} has been processed and is ready for report generation.`,
      });
    } catch (error) {
      console.error('Upload error:', error);
      setUploadedFile(null);
      toast({
        title: "Upload failed",
        description: "Please try again with a valid Excel file.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  }, [onFileUploaded, fileType, toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  return (
    <Card>
      <CardContent className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">{title}</h2>
        
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
            isDragActive 
              ? "border-blue-600 bg-blue-50" 
              : uploadedFile 
                ? "border-green-300 bg-green-50" 
                : "border-gray-300 hover:border-blue-600"
          }`}
        >
          <input {...getInputProps()} />
          
          {isUploading ? (
            <div className="space-y-4">
              <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-gray-600">Uploading and processing...</p>
            </div>
          ) : uploadedFile ? (
            <div className="space-y-4">
              <CheckCircle className="w-12 h-12 text-green-600 mx-auto" />
              <h3 className="text-lg font-medium text-gray-900">File uploaded successfully!</h3>
              <p className="text-gray-500">{uploadedFile.name}</p>
              <p className="text-xs text-gray-400">
                ({(uploadedFile.size / (1024 * 1024)).toFixed(2)} MB)
              </p>
              <div className="flex items-center justify-center space-x-2">
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  <FileSpreadsheet className="w-3 h-3 mr-1" />
                  Excel File
                </span>
              </div>
              <div className="flex justify-center">
                <Button
                  variant="outline"
                  onClick={() => {
                    setUploadedFile(null);
                    // Reset the file input
                    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
                    if (fileInput) fileInput.value = '';
                    // Notify parent to reset data preview
                    if (onReset) onReset();
                  }}
                  className="text-blue-600 hover:text-blue-700 border-blue-200 hover:border-blue-300"
                >
                  Replace Document
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <CloudUpload className="w-12 h-12 text-gray-400 mx-auto" />
              <h3 className="text-lg font-medium text-gray-900">
                {isDragActive ? "Drop your Excel file here" : "Drop your Excel file here"}
              </h3>
              <p className="text-gray-500">or click to browse files</p>
              <p className="text-xs text-gray-400">Supports .xlsx and .xls files up to 10MB</p>
              <Button className="mt-4 bg-blue-600 hover:bg-blue-700">
                Choose File
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}