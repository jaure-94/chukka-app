
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SidebarNavigation, MobileNavigation } from "@/components/sidebar-navigation";
import { FileText, Upload, Calendar, User, Download, Edit } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useSidebar } from "@/contexts/sidebar-context";
import { useShipContext } from "@/contexts/ship-context";
import { Link, useParams, useLocation } from "wouter";

interface Template {
  id: number;
  filename: string;
  originalFilename: string;
  filePath: string;
  createdAt: string;
  isActive: boolean;
}

function Templates() {
  const { isCollapsed } = useSidebar();
  const { setCurrentShip, getShipDisplayName } = useShipContext();
  const params = useParams();
  const [location] = useLocation();
  
  // Extract ship from URL params (/templates/ship-a)
  const shipFromUrl = params.ship as string;
  const currentShip = (shipFromUrl || 'ship-a') as 'ship-a' | 'ship-b' | 'ship-c';
  
  // Debug logging to see what ship is being extracted
  console.log('Templates page - Current location:', location);
  console.log('Templates page - Ship from URL params:', shipFromUrl);
  console.log('Templates page - Current ship:', currentShip);
  
  // Update ship context when URL changes
  React.useEffect(() => {
    if (shipFromUrl && ['ship-a', 'ship-b', 'ship-c'].includes(shipFromUrl)) {
      setCurrentShip(shipFromUrl as 'ship-a' | 'ship-b' | 'ship-c');
    }
  }, [shipFromUrl, setCurrentShip]);

  // Fetch current templates from storage for the specific ship
  const { data: dispatchTemplate } = useQuery<Template | null>({
    queryKey: ["/api/dispatch-templates", currentShip],
    queryFn: async () => {
      const res = await fetch(`/api/dispatch-templates?ship=${currentShip}`);
      const data = await res.json();
      // Return null if empty object (no template found)
      return Object.keys(data).length === 0 ? null : data;
    },
    enabled: !!currentShip,
  });

  const { data: eodTemplate } = useQuery<Template | null>({
    queryKey: ["/api/eod-templates", currentShip],
    queryFn: async () => {
      const res = await fetch(`/api/eod-templates?ship=${currentShip}`);
      const data = await res.json();
      // Return null if empty object (no template found)
      return Object.keys(data).length === 0 ? null : data;
    },
    enabled: !!currentShip,
  });

  const { data: paxTemplate } = useQuery<Template | null>({
    queryKey: ["/api/pax-templates", currentShip],
    queryFn: async () => {
      const res = await fetch(`/api/pax-templates?ship=${currentShip}`);
      const data = await res.json();
      // Return null if empty object (no template found)
      return Object.keys(data).length === 0 ? null : data;
    },
    enabled: !!currentShip,
  });



  const handleDownloadTemplate = (type: 'dispatch' | 'eod' | 'pax') => {
    window.open(`/api/templates/${type}/download?ship=${currentShip}`, '_blank');
  };

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
            <div className="py-6 flex items-center justify-between">
              <div className="flex items-center">
                <MobileNavigation />
                <div className="ml-4 md:ml-0">
                  <h1 className="text-3xl font-bold text-gray-900">Templates - {getShipDisplayName(currentShip)}</h1>
                  <p className="mt-2 text-gray-600">
                    Manage your dispatch, EOD, and PAX template documents for {getShipDisplayName(currentShip)}
                  </p>
                </div>
              </div>
              <Link href={`/templates/edit/${currentShip}`}>
                <Button className="bg-blue-600 hover:bg-blue-700">
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Templates
                </Button>
              </Link>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
            {/* Dispatch Template Card */}
            <Card className="h-fit">
              <CardHeader>
                <CardTitle className="flex items-center text-lg">
                  <FileText className="w-5 h-5 mr-2 text-blue-600" />
                  Dispatch Template
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {dispatchTemplate ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Status:</span>
                      <Badge variant="default" className="bg-green-100 text-green-800">
                        Active
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Filename:</span>
                      <span className="text-sm text-gray-600 truncate max-w-48">
                        {dispatchTemplate.originalFilename || "dispatch_template.xlsx"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Upload Date:</span>
                      <span className="text-sm text-gray-600 flex items-center">
                        <Calendar className="w-3 h-3 mr-1" />
                        {dispatchTemplate.createdAt 
                          ? new Date(dispatchTemplate.createdAt).toLocaleDateString()
                          : "Recently uploaded"
                        }
                      </span>
                    </div>
                    <div className="pt-3 border-t border-gray-100">
                      <p className="text-xs text-gray-500 mb-3">
                        This template contains placeholders for tour information including tour names, 
                        guest counts, departure times, and notes.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadTemplate('dispatch')}
                        className="w-full"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download Template
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <FileText className="w-8 h-8 text-gray-400" />
                    </div>
                    <p className="text-gray-500 mb-4">No dispatch template uploaded for {getShipDisplayName(currentShip)}</p>
                    <Link href={`/templates/edit/${currentShip}`}>
                      <Button variant="outline" size="sm">
                        Upload Template
                      </Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* EOD Template Card */}
            <Card className="h-fit">
              <CardHeader>
                <CardTitle className="flex items-center text-lg">
                  <FileText className="w-5 h-5 mr-2 text-green-600" />
                  EOD Report Template
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {eodTemplate ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Status:</span>
                      <Badge variant="default" className="bg-green-100 text-green-800">
                        Active
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Filename:</span>
                      <span className="text-sm text-gray-600 truncate max-w-48">
                        {eodTemplate.originalFilename || "eod_template.xlsx"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Upload Date:</span>
                      <span className="text-sm text-gray-600 flex items-center">
                        <Calendar className="w-3 h-3 mr-1" />
                        {eodTemplate.createdAt 
                          ? new Date(eodTemplate.createdAt).toLocaleDateString()
                          : "Recently uploaded"
                        }
                      </span>
                    </div>
                    <div className="pt-3 border-t border-gray-100">
                      <p className="text-xs text-gray-500 mb-3">
                        This template is populated with dispatch data to generate end-of-day reports 
                        with tour summaries and guest counts.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadTemplate('eod')}
                        className="w-full"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download Template
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <FileText className="w-8 h-8 text-gray-400" />
                    </div>
                    <p className="text-gray-500 mb-4">No EOD template uploaded for {getShipDisplayName(currentShip)}</p>
                    <Link href={`/templates/edit/${currentShip}`}>
                      <Button variant="outline" size="sm">
                        Upload Template
                      </Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* PAX Report Template Card */}
            <Card className="h-fit">
              <CardHeader>
                <CardTitle className="flex items-center text-lg">
                  <FileText className="w-5 h-5 mr-2 text-purple-600" />
                  PAX Report Template
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {paxTemplate ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Status:</span>
                      <Badge variant="default" className="bg-green-100 text-green-800">
                        Active
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Filename:</span>
                      <span className="text-sm text-gray-600 truncate max-w-48">
                        {paxTemplate.originalFilename || "pax_template.xlsx"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Upload Date:</span>
                      <span className="text-sm text-gray-600 flex items-center">
                        <Calendar className="w-3 h-3 mr-1" />
                        {paxTemplate.createdAt 
                          ? new Date(paxTemplate.createdAt).toLocaleDateString()
                          : "Recently uploaded"
                        }
                      </span>
                    </div>
                    <div className="pt-3 border-t border-gray-100">
                      <p className="text-xs text-gray-500 mb-3">
                        This template generates passenger (PAX) reports with detailed guest information 
                        and tour participation data from dispatch records.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadTemplate('pax')}
                        className="w-full"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download Template
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <FileText className="w-8 h-8 text-gray-400" />
                    </div>
                    <p className="text-gray-500 mb-4">No PAX report template uploaded for {getShipDisplayName(currentShip)}</p>
                    <Link href={`/templates/edit/${currentShip}`}>
                      <Button variant="outline" size="sm">
                        Upload Template
                      </Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Template Information Section */}
          <Card className="mt-8">
            <CardHeader>
              <CardTitle className="flex items-center">
                <User className="w-5 h-5 mr-2 text-purple-600" />
                Template Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">How Templates Work</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Upload your Excel templates with placeholder delimiters</li>
                    <li>• Create dispatch records to populate template data</li>
                    <li>• Generate reports with real data replacing placeholders</li>
                    <li>• Download completed documents with all information filled</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Supported Placeholders</h4>
                  <div className="text-sm text-gray-600 space-y-1">
                    <div className="flex items-center">
                      <code className="bg-gray-100 px-2 py-1 rounded text-xs mr-2">{'{{tour_name}}'}</code>
                      <span>Tour name</span>
                    </div>
                    <div className="flex items-center">
                      <code className="bg-gray-100 px-2 py-1 rounded text-xs mr-2">{'{{num_adult}}'}</code>
                      <span>Number of adults</span>
                    </div>
                    <div className="flex items-center">
                      <code className="bg-gray-100 px-2 py-1 rounded text-xs mr-2">{'{{num_chd}}'}</code>
                      <span>Number of children</span>
                    </div>
                    <div className="flex items-center">
                      <code className="bg-gray-100 px-2 py-1 rounded text-xs mr-2">{'{{notes}}'}</code>
                      <span>Additional notes</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}

export default Templates;