import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

interface TemplateSelectorProps {
  selectedTemplate: string;
  onTemplateChange: (value: string) => void;
  disabled?: boolean;
}

const templates = [
  {
    value: "employee-report",
    title: "Employee Report",
    description: "Generate detailed employee reports",
  },
  {
    value: "summary-report",
    title: "Summary Report", 
    description: "Quick overview and statistics",
  },
  {
    value: "customer-participation",
    title: "Guest Participation Report",
    description: "Excursion attendance and guest management",
  },
  {
    value: "custom",
    title: "Custom Template",
    description: "Upload your own template",
  },
];

export function TemplateSelector({ selectedTemplate, onTemplateChange, disabled }: TemplateSelectorProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Template Selection</h3>
        
        <RadioGroup value={selectedTemplate} onValueChange={onTemplateChange} disabled={disabled}>
          <div className="space-y-3">
            {templates.map((template) => (
              <div key={template.value} className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50">
                <RadioGroupItem value={template.value} id={template.value} />
                <Label htmlFor={template.value} className="flex-1 cursor-pointer">
                  <div className="font-medium text-sm">{template.title}</div>
                  <div className="text-xs text-gray-500">{template.description}</div>
                </Label>
              </div>
            ))}
          </div>
        </RadioGroup>
      </CardContent>
    </Card>
  );
}
