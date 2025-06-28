import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export function ExportSettings() {
  return (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Export Settings</h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Dropbox Connection</span>
            <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">
              Connected
            </Badge>
          </div>
          
          <div>
            <Label htmlFor="export-folder" className="block text-sm font-medium text-gray-700 mb-2">
              Export Folder
            </Label>
            <Select defaultValue="reports">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="reports">Reports/</SelectItem>
                <SelectItem value="data-processing">Data Processing/</SelectItem>
                <SelectItem value="archives">Archives/</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center space-x-2">
            <Checkbox id="auto-export" defaultChecked />
            <Label htmlFor="auto-export" className="text-sm text-gray-600">
              Auto-export after processing
            </Label>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
