import { Upload, Eye, FileCheck, FileText, Package } from "lucide-react";

interface ProcessingStepperProps {
  currentStep: number;
}

const steps = [
  { icon: Upload, label: "Document Upload", description: "Upload Excel files" },
  { icon: Eye, label: "Data Preview", description: "Preview dispatch data" },
  { icon: FileText, label: "Report Generation", description: "Generate report" },
  { icon: Package, label: "Export", description: "Export to Dropbox" },
];

export function ProcessingStepper({ currentStep }: ProcessingStepperProps) {
  return (
    <nav aria-label="Progress">
      <ol className="flex items-center justify-center">
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;
          const isUpcoming = index > currentStep;
          
          const Icon = step.icon;
          
          return (
            <li key={index} className={`relative ${index < steps.length - 1 ? "pr-8 sm:pr-20" : ""}`}>
              {index < steps.length - 1 && (
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className={`h-0.5 w-full ${isCompleted ? "bg-blue-600" : "bg-gray-200"}`} />
                </div>
              )}
              
              <div
                className={`relative flex h-8 w-8 items-center justify-center rounded-full ${
                  isCompleted 
                    ? "bg-blue-600 text-white" 
                    : isCurrent 
                      ? "bg-blue-600 text-white" 
                      : "bg-gray-200 text-gray-400"
                }`}
              >
                <Icon className="w-4 h-4" />
              </div>
              
              <span
                className={`absolute top-10 left-1/2 transform -translate-x-1/2 text-xs font-medium ${
                  isCompleted || isCurrent ? "text-blue-600" : "text-gray-400"
                }`}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
