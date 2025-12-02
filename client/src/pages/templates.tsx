
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SidebarNavigation, MobileNavigation } from "@/components/sidebar-navigation";
import { ShipSelector } from "@/components/ship-selector";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { FileText, Upload, Calendar, User, Download, Edit, AlertTriangle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useSidebar } from "@/contexts/sidebar-context";
import { useShipContext } from "@/contexts/ship-context";
import { Link, useParams, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";

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
  const { user } = useAuth();
  const params = useParams();
  const [location] = useLocation();
  
  // Extract ship from URL params (/templates/ship-a)
  const shipFromUrl = params.ship as string;
  const currentShip = (shipFromUrl || 'ship-a') as 'ship-a' | 'ship-b' | 'ship-c';
  

  
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
    <div className="h-screen bg-gray-50 flex overflow-hidden">
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
                  Templates
                </h1>
                <p className="text-xs sm:text-sm text-blue-600 truncate">
                  {getShipDisplayName(currentShip)}
                </p>
              </div>
              {user?.role !== 'general' && (
                <Link href={`/templates/edit/${currentShip}`}>
                  <Button 
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 h-9 sm:h-10 text-xs sm:text-sm touch-manipulation flex-shrink-0"
                  >
                    <Edit className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                    <span className="hidden sm:inline">Edit</span>
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </header>

        {/* Breadcrumbs - Mobile Optimized */}
        <Breadcrumbs />

        <div className="flex-1 overflow-y-auto">
        {/* Header - Desktop Only */}
        <header className="bg-white shadow-sm border-b hidden md:block">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="py-6 flex items-center justify-between">
              <div className="flex items-center">
                <MobileNavigation />
                <div className="ml-4 md:ml-0">
                  <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Templates - {getShipDisplayName(currentShip)}</h1>
                  <p className="mt-2 text-sm sm:text-base text-gray-600">
                    Manage your dispatch, EOD, and PAX template documents for {getShipDisplayName(currentShip)}
                  </p>
                </div>
              </div>
              {user?.role !== 'general' && (
                <Link href={`/templates/edit/${currentShip}`}>
                  <Button className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 h-10 sm:h-11 text-sm sm:text-base touch-manipulation">
                    <Edit className="w-4 h-4 mr-2" />
                    Edit Templates
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 max-w-7xl mx-auto w-full px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8 overflow-y-auto">
          {/* Ship Selector */}
          <div className="mb-4 sm:mb-6 md:mb-8">
            <ShipSelector />
          </div>

          {!currentShip ? (
            <Card className="touch-manipulation">
              <CardContent className="text-center py-6 sm:py-8 px-3 sm:px-4">
                <AlertTriangle className="w-10 h-10 sm:w-12 sm:h-12 text-yellow-500 mx-auto mb-3 sm:mb-4" />
                <p className="text-sm sm:text-base text-gray-600 mb-3 sm:mb-4">Please select a ship above to view templates.</p>
                <p className="text-xs sm:text-sm text-gray-500">Each ship maintains separate templates and data for complete isolation.</p>
              </CardContent>
            </Card>
          ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5 md:gap-6 lg:gap-8">
            {/* Dispatch Template Card */}
            <Card className="h-fit hover:shadow-lg active:shadow-md transition-all duration-200 touch-manipulation">
              <CardHeader className="px-3 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4">
                <CardTitle className="flex items-center text-base sm:text-lg">
                  <FileText className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-blue-600 flex-shrink-0" />
                  <span>Dispatch Template</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 sm:space-y-4 px-3 sm:px-6 pb-4 sm:pb-6">
                {dispatchTemplate ? (
                  <div className="space-y-2 sm:space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2">
                      <span className="text-xs sm:text-sm font-medium text-gray-700">Status:</span>
                      <Badge variant="default" className="bg-green-100 text-green-800 text-xs w-fit sm:w-auto">
                        Active
                      </Badge>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2">
                      <span className="text-xs sm:text-sm font-medium text-gray-700">Filename:</span>
                      <span className="text-xs sm:text-sm text-gray-600 break-words sm:truncate sm:max-w-48 text-right sm:text-left">
                        {dispatchTemplate.originalFilename || "dispatch_template.xlsx"}
                      </span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2">
                      <span className="text-xs sm:text-sm font-medium text-gray-700">Upload Date:</span>
                      <span className="text-xs sm:text-sm text-gray-600 flex items-center justify-end sm:justify-start">
                        <Calendar className="w-3 h-3 mr-1 flex-shrink-0" />
                        {dispatchTemplate.createdAt 
                          ? new Date(dispatchTemplate.createdAt).toLocaleDateString()
                          : "Recently uploaded"
                        }
                      </span>
                    </div>
                    <div className="pt-2 sm:pt-3 border-t border-gray-100">
                      <p className="text-xs text-gray-500 mb-2 sm:mb-3 leading-relaxed">
                        This template contains placeholders for tour information including tour names, 
                        guest counts, departure times, and notes.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadTemplate('dispatch')}
                        className="w-full h-10 sm:h-11 text-xs sm:text-sm touch-manipulation"
                      >
                        <Download className="w-3 h-3 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
                        Download Template
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 sm:py-8">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                      <FileText className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400" />
                    </div>
                    <p className="text-xs sm:text-sm text-gray-500 mb-3 sm:mb-4 px-2">No dispatch template uploaded for {getShipDisplayName(currentShip)}</p>
                    <Link href={`/templates/edit/${currentShip}`}>
                      <Button variant="outline" size="sm" className="h-10 sm:h-11 text-xs sm:text-sm touch-manipulation">
                        Upload Template
                      </Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* EOD Template Card */}
            <Card className="h-fit hover:shadow-lg active:shadow-md transition-all duration-200 touch-manipulation">
              <CardHeader className="px-3 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4">
                <CardTitle className="flex items-center text-base sm:text-lg">
                  <FileText className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-green-600 flex-shrink-0" />
                  <span>EOD Report Template</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 sm:space-y-4 px-3 sm:px-6 pb-4 sm:pb-6">
                {eodTemplate ? (
                  <div className="space-y-2 sm:space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2">
                      <span className="text-xs sm:text-sm font-medium text-gray-700">Status:</span>
                      <Badge variant="default" className="bg-green-100 text-green-800 text-xs w-fit sm:w-auto">
                        Active
                      </Badge>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2">
                      <span className="text-xs sm:text-sm font-medium text-gray-700">Filename:</span>
                      <span className="text-xs sm:text-sm text-gray-600 break-words sm:truncate sm:max-w-48 text-right sm:text-left">
                        {eodTemplate.originalFilename || "eod_template.xlsx"}
                      </span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2">
                      <span className="text-xs sm:text-sm font-medium text-gray-700">Upload Date:</span>
                      <span className="text-xs sm:text-sm text-gray-600 flex items-center justify-end sm:justify-start">
                        <Calendar className="w-3 h-3 mr-1 flex-shrink-0" />
                        {eodTemplate.createdAt 
                          ? new Date(eodTemplate.createdAt).toLocaleDateString()
                          : "Recently uploaded"
                        }
                      </span>
                    </div>
                    <div className="pt-2 sm:pt-3 border-t border-gray-100">
                      <p className="text-xs text-gray-500 mb-2 sm:mb-3 leading-relaxed">
                        This template is populated with dispatch data to generate end-of-day reports 
                        with tour summaries and guest counts.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadTemplate('eod')}
                        className="w-full h-10 sm:h-11 text-xs sm:text-sm touch-manipulation"
                      >
                        <Download className="w-3 h-3 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
                        Download Template
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 sm:py-8">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                      <FileText className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400" />
                    </div>
                    <p className="text-xs sm:text-sm text-gray-500 mb-3 sm:mb-4 px-2">No EOD template uploaded for {getShipDisplayName(currentShip)}</p>
                    <Link href={`/templates/edit/${currentShip}`}>
                      <Button variant="outline" size="sm" className="h-10 sm:h-11 text-xs sm:text-sm touch-manipulation">
                        Upload Template
                      </Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* PAX Report Template Card */}
            <Card className="h-fit hover:shadow-lg active:shadow-md transition-all duration-200 touch-manipulation">
              <CardHeader className="px-3 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4">
                <CardTitle className="flex items-center text-base sm:text-lg">
                  <FileText className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-purple-600 flex-shrink-0" />
                  <span>PAX Report Template</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 sm:space-y-4 px-3 sm:px-6 pb-4 sm:pb-6">
                {paxTemplate ? (
                  <div className="space-y-2 sm:space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2">
                      <span className="text-xs sm:text-sm font-medium text-gray-700">Status:</span>
                      <Badge variant="default" className="bg-green-100 text-green-800 text-xs w-fit sm:w-auto">
                        Active
                      </Badge>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2">
                      <span className="text-xs sm:text-sm font-medium text-gray-700">Filename:</span>
                      <span className="text-xs sm:text-sm text-gray-600 break-words sm:truncate sm:max-w-48 text-right sm:text-left">
                        {paxTemplate.originalFilename || "pax_template.xlsx"}
                      </span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2">
                      <span className="text-xs sm:text-sm font-medium text-gray-700">Upload Date:</span>
                      <span className="text-xs sm:text-sm text-gray-600 flex items-center justify-end sm:justify-start">
                        <Calendar className="w-3 h-3 mr-1 flex-shrink-0" />
                        {paxTemplate.createdAt 
                          ? new Date(paxTemplate.createdAt).toLocaleDateString()
                          : "Recently uploaded"
                        }
                      </span>
                    </div>
                    <div className="pt-2 sm:pt-3 border-t border-gray-100">
                      <p className="text-xs text-gray-500 mb-2 sm:mb-3 leading-relaxed">
                        This template generates passenger (PAX) reports with detailed guest information 
                        and tour participation data from dispatch records.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadTemplate('pax')}
                        className="w-full h-10 sm:h-11 text-xs sm:text-sm touch-manipulation"
                      >
                        <Download className="w-3 h-3 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
                        Download Template
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 sm:py-8">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                      <FileText className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400" />
                    </div>
                    <p className="text-xs sm:text-sm text-gray-500 mb-3 sm:mb-4 px-2">No PAX report template uploaded for {getShipDisplayName(currentShip)}</p>
                    <Link href={`/templates/edit/${currentShip}`}>
                      <Button variant="outline" size="sm" className="h-10 sm:h-11 text-xs sm:text-sm touch-manipulation">
                        Upload Template
                      </Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          )}

          {/* Template Information Section */}
          <Card className="mt-4 sm:mt-6 md:mt-8 touch-manipulation">
            <CardHeader className="px-3 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4">
              <CardTitle className="flex items-center text-base sm:text-lg">
                <User className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-purple-600 flex-shrink-0" />
                <span>Template Information</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 px-3 sm:px-6 pb-4 sm:pb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 md:gap-6">
                <div>
                  <h4 className="font-medium text-gray-900 mb-2 text-sm sm:text-base">How Templates Work</h4>
                  <ul className="text-xs sm:text-sm text-gray-600 space-y-1.5 sm:space-y-2 leading-relaxed">
                    <li className="flex items-start">
                      <span className="mr-2 flex-shrink-0">•</span>
                      <span>Upload your Excel templates with placeholder delimiters</span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-2 flex-shrink-0">•</span>
                      <span>Create dispatch records to populate template data</span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-2 flex-shrink-0">•</span>
                      <span>Generate reports with real data replacing placeholders</span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-2 flex-shrink-0">•</span>
                      <span>Download completed documents with all information filled</span>
                    </li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 mb-2 text-sm sm:text-base">Supported Placeholders</h4>
                  <div className="text-xs sm:text-sm text-gray-600 space-y-2 sm:space-y-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                      <code className="bg-gray-100 px-2 py-1 rounded text-xs font-mono flex-shrink-0 w-fit">{'{{tour_name}}'}</code>
                      <span>Tour name</span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                      <code className="bg-gray-100 px-2 py-1 rounded text-xs font-mono flex-shrink-0 w-fit">{'{{num_adult}}'}</code>
                      <span>Number of adults</span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                      <code className="bg-gray-100 px-2 py-1 rounded text-xs font-mono flex-shrink-0 w-fit">{'{{num_chd}}'}</code>
                      <span>Number of children</span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                      <code className="bg-gray-100 px-2 py-1 rounded text-xs font-mono flex-shrink-0 w-fit">{'{{notes}}'}</code>
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
    </div>
  );
}

export default Templates;