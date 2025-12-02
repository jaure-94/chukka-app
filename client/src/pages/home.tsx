import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SidebarNavigation, MobileNavigation } from "@/components/sidebar-navigation";
import { Crown, Shield, Clipboard, User, Ship, Database, Lock, FileText, BarChart3, Users, ArrowRight, Upload, Settings, Download } from "lucide-react";
import { useSidebar } from "@/contexts/sidebar-context";
import { useAuth } from "@/hooks/use-auth";

export default function Home() {
  const { isCollapsed } = useSidebar();
  const { user } = useAuth();

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'superuser':
        return <Crown className="w-5 h-5 text-yellow-600" />;
      case 'admin':
        return <Shield className="w-5 h-5 text-blue-600" />;
      case 'dispatcher':
        return <Clipboard className="w-5 h-5 text-green-600" />;
      default:
        return <User className="w-5 h-5 text-gray-600" />;
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'superuser':
        return 'default';
      case 'admin':
        return 'secondary';
      case 'dispatcher':
        return 'outline';
      default:
        return 'outline';
    }
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
        <header className="bg-gradient-to-r from-blue-600 to-blue-800 text-white">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="py-8 sm:py-12 lg:py-16 text-center">
              <div className="flex items-center justify-start mb-4 sm:mb-6 md:hidden">
                <MobileNavigation />
              </div>
              <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-bold mb-3 sm:mb-4 md:mb-6 px-2 leading-tight">
                Maritime Operations Management
              </h1>
              <p className="text-sm sm:text-base md:text-lg lg:text-xl text-blue-100 mb-4 sm:mb-6 md:mb-8 max-w-4xl mx-auto px-4 leading-relaxed">
                Advanced multi-ship dispatch and reporting system with comprehensive role-based access control
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center space-y-2 sm:space-y-0 sm:space-x-2 mb-4 sm:mb-6 md:mb-8 px-4">
                {user && (
                  <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-2 bg-white/20 backdrop-blur-sm rounded-full px-3 sm:px-4 py-2 sm:py-2.5 border border-white/30 w-full sm:w-auto">
                    <div className="flex items-center space-x-2">
                      <div className="flex-shrink-0">
                        {getRoleIcon(user.role)}
                      </div>
                      <span className="text-xs sm:text-sm font-medium whitespace-nowrap">Welcome, {user.firstName}</span>
                    </div>
                    <Badge variant={getRoleBadgeVariant(user.role)} className="bg-white/20 text-white border-white/30 text-xs sm:text-sm px-2 sm:px-2.5 py-0.5 sm:py-1">
                      {user.role}
                    </Badge>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
          <div className="max-w-7xl mx-auto space-y-8 sm:space-y-12 lg:space-y-16">
            {/* Three Ship System Overview */}
            <section className="text-center">
              <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 mb-3 sm:mb-4 md:mb-6 leading-tight">
                Multi-Ship Management System
              </h2>
              <p className="text-sm sm:text-base md:text-lg text-gray-600 mb-6 sm:mb-8 md:mb-12 max-w-4xl mx-auto px-2 leading-relaxed">
                Our system provides complete data isolation and dedicated management for three distinct vessels, 
                ensuring operational security and organizational clarity.
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 md:gap-6 lg:gap-8">
                <Card className="hover:shadow-lg active:shadow-md transition-all duration-200 h-full flex flex-col touch-manipulation">
                  <CardHeader className="text-center flex-shrink-0 px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                      <Ship className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-blue-600" />
                    </div>
                    <CardTitle className="text-blue-600 text-base sm:text-lg font-semibold">Ship A Operations</CardTitle>
                  </CardHeader>
                  <CardContent className="flex-grow flex flex-col justify-between px-4 sm:px-6 pb-4 sm:pb-6">
                    <p className="text-gray-600 mb-4 text-sm sm:text-base leading-relaxed">
                      Dedicated templates, dispatch records, and reporting system for Ship A operations.
                    </p>
                    <div className="flex items-center justify-center space-x-2 mt-auto pt-2">
                      <Database className="w-4 h-4 sm:w-4 sm:h-4 text-gray-400 flex-shrink-0" />
                      <span className="text-xs sm:text-sm text-gray-500">Isolated Data Environment</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="hover:shadow-lg active:shadow-md transition-all duration-200 h-full flex flex-col touch-manipulation">
                  <CardHeader className="text-center flex-shrink-0 px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                      <Ship className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-green-600" />
                    </div>
                    <CardTitle className="text-green-600 text-base sm:text-lg font-semibold">Ship B Operations</CardTitle>
                  </CardHeader>
                  <CardContent className="flex-grow flex flex-col justify-between px-4 sm:px-6 pb-4 sm:pb-6">
                    <p className="text-gray-600 mb-4 text-sm sm:text-base leading-relaxed">
                      Complete separation of Ship B data, templates, and operational workflows.
                    </p>
                    <div className="flex items-center justify-center space-x-2 mt-auto pt-2">
                      <Database className="w-4 h-4 sm:w-4 sm:h-4 text-gray-400 flex-shrink-0" />
                      <span className="text-xs sm:text-sm text-gray-500">Isolated Data Environment</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="hover:shadow-lg active:shadow-md transition-all duration-200 h-full flex flex-col sm:col-span-2 lg:col-span-1 touch-manipulation">
                  <CardHeader className="text-center flex-shrink-0 px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                      <Ship className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-purple-600" />
                    </div>
                    <CardTitle className="text-purple-600 text-base sm:text-lg font-semibold">Ship C Operations</CardTitle>
                  </CardHeader>
                  <CardContent className="flex-grow flex flex-col justify-between px-4 sm:px-6 pb-4 sm:pb-6">
                    <p className="text-gray-600 mb-4 text-sm sm:text-base leading-relaxed">
                      Independent management system for Ship C with dedicated resources and data storage.
                    </p>
                    <div className="flex items-center justify-center space-x-2 mt-auto pt-2">
                      <Database className="w-4 h-4 sm:w-4 sm:h-4 text-gray-400 flex-shrink-0" />
                      <span className="text-xs sm:text-sm text-gray-500">Isolated Data Environment</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </section>

            {/* Role-Based Access Control */}
            <section className="bg-gray-100 rounded-xl p-4 sm:p-5 md:p-6 lg:p-8">
              <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 mb-3 sm:mb-4 md:mb-6 text-center leading-tight">
                Role-Based Access Control
              </h2>
              <p className="text-sm sm:text-base md:text-lg text-gray-600 mb-6 sm:mb-8 md:mb-12 text-center max-w-4xl mx-auto px-2 leading-relaxed">
                Four-tier security system ensuring appropriate access levels for all users across the maritime operations platform.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 md:gap-6 lg:gap-8">
                <Card className="border-2 border-yellow-200 hover:shadow-lg active:shadow-md transition-all duration-200 h-full flex flex-col touch-manipulation">
                  <CardHeader className="text-center flex-shrink-0 px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                      <Crown className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-yellow-600" />
                    </div>
                    <CardTitle className="text-yellow-700 text-base sm:text-lg font-semibold">Superuser</CardTitle>
                  </CardHeader>
                  <CardContent className="flex-grow px-4 sm:px-6 pb-4 sm:pb-6">
                    <ul className="text-xs sm:text-sm text-gray-600 space-y-2 sm:space-y-2.5">
                      <li className="flex items-start">
                        <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-yellow-400 rounded-full mr-2 sm:mr-2.5 mt-1.5 flex-shrink-0"></div>
                        <span className="leading-relaxed">Full system access</span>
                      </li>
                      <li className="flex items-start">
                        <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-yellow-400 rounded-full mr-2 sm:mr-2.5 mt-1.5 flex-shrink-0"></div>
                        <span className="leading-relaxed">User management</span>
                      </li>
                      <li className="flex items-start">
                        <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-yellow-400 rounded-full mr-2 sm:mr-2.5 mt-1.5 flex-shrink-0"></div>
                        <span className="leading-relaxed">All ship operations</span>
                      </li>
                      <li className="flex items-start">
                        <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-yellow-400 rounded-full mr-2 sm:mr-2.5 mt-1.5 flex-shrink-0"></div>
                        <span className="leading-relaxed">System configuration</span>
                      </li>
                    </ul>
                  </CardContent>
                </Card>

                <Card className="border-2 border-blue-200 hover:shadow-lg active:shadow-md transition-all duration-200 h-full flex flex-col touch-manipulation">
                  <CardHeader className="text-center flex-shrink-0 px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                      <Shield className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-blue-600" />
                    </div>
                    <CardTitle className="text-blue-700 text-base sm:text-lg font-semibold">Admin</CardTitle>
                  </CardHeader>
                  <CardContent className="flex-grow px-4 sm:px-6 pb-4 sm:pb-6">
                    <ul className="text-xs sm:text-sm text-gray-600 space-y-2 sm:space-y-2.5">
                      <li className="flex items-start">
                        <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-blue-400 rounded-full mr-2 sm:mr-2.5 mt-1.5 flex-shrink-0"></div>
                        <span className="leading-relaxed">User management</span>
                      </li>
                      <li className="flex items-start">
                        <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-blue-400 rounded-full mr-2 sm:mr-2.5 mt-1.5 flex-shrink-0"></div>
                        <span className="leading-relaxed">Template management</span>
                      </li>
                      <li className="flex items-start">
                        <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-blue-400 rounded-full mr-2 sm:mr-2.5 mt-1.5 flex-shrink-0"></div>
                        <span className="leading-relaxed">Report generation</span>
                      </li>
                      <li className="flex items-start">
                        <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-blue-400 rounded-full mr-2 sm:mr-2.5 mt-1.5 flex-shrink-0"></div>
                        <span className="leading-relaxed">Ship operations</span>
                      </li>
                    </ul>
                  </CardContent>
                </Card>

                <Card className="border-2 border-green-200 hover:shadow-lg active:shadow-md transition-all duration-200 h-full flex flex-col touch-manipulation">
                  <CardHeader className="text-center flex-shrink-0 px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                      <Clipboard className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-green-600" />
                    </div>
                    <CardTitle className="text-green-700 text-base sm:text-lg font-semibold">Dispatcher</CardTitle>
                  </CardHeader>
                  <CardContent className="flex-grow px-4 sm:px-6 pb-4 sm:pb-6">
                    <ul className="text-xs sm:text-sm text-gray-600 space-y-2 sm:space-y-2.5">
                      <li className="flex items-start">
                        <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-400 rounded-full mr-2 sm:mr-2.5 mt-1.5 flex-shrink-0"></div>
                        <span className="leading-relaxed">Create dispatch records</span>
                      </li>
                      <li className="flex items-start">
                        <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-400 rounded-full mr-2 sm:mr-2.5 mt-1.5 flex-shrink-0"></div>
                        <span className="leading-relaxed">Edit spreadsheets</span>
                      </li>
                      <li className="flex items-start">
                        <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-400 rounded-full mr-2 sm:mr-2.5 mt-1.5 flex-shrink-0"></div>
                        <span className="leading-relaxed">Generate reports</span>
                      </li>
                      <li className="flex items-start">
                        <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-400 rounded-full mr-2 sm:mr-2.5 mt-1.5 flex-shrink-0"></div>
                        <span className="leading-relaxed">View ship data</span>
                      </li>
                    </ul>
                  </CardContent>
                </Card>

                <Card className="border-2 border-gray-200 hover:shadow-lg active:shadow-md transition-all duration-200 h-full flex flex-col sm:col-span-2 lg:col-span-1 touch-manipulation">
                  <CardHeader className="text-center flex-shrink-0 px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                      <User className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-gray-600" />
                    </div>
                    <CardTitle className="text-gray-700 text-base sm:text-lg font-semibold">General User</CardTitle>
                  </CardHeader>
                  <CardContent className="flex-grow px-4 sm:px-6 pb-4 sm:pb-6">
                    <ul className="text-xs sm:text-sm text-gray-600 space-y-2 sm:space-y-2.5">
                      <li className="flex items-start">
                        <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-gray-400 rounded-full mr-2 sm:mr-2.5 mt-1.5 flex-shrink-0"></div>
                        <span className="leading-relaxed">View-only access</span>
                      </li>
                      <li className="flex items-start">
                        <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-gray-400 rounded-full mr-2 sm:mr-2.5 mt-1.5 flex-shrink-0"></div>
                        <span className="leading-relaxed">Read reports</span>
                      </li>
                      <li className="flex items-start">
                        <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-gray-400 rounded-full mr-2 sm:mr-2.5 mt-1.5 flex-shrink-0"></div>
                        <span className="leading-relaxed">Download files</span>
                      </li>
                      <li className="flex items-start">
                        <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-gray-400 rounded-full mr-2 sm:mr-2.5 mt-1.5 flex-shrink-0"></div>
                        <span className="leading-relaxed">View ship status</span>
                      </li>
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </section>

            {/* System Features */}
            <section>
              <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 mb-3 sm:mb-4 md:mb-6 text-center leading-tight">Platform Features</h2>
              <p className="text-sm sm:text-base md:text-lg text-gray-600 mb-6 sm:mb-8 md:mb-12 text-center max-w-4xl mx-auto px-2 leading-relaxed">
                Comprehensive maritime operations platform with advanced features for efficient workflow management.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 md:gap-6 lg:gap-8">
                <Card className="hover:shadow-lg active:shadow-md transition-all duration-200 h-full flex flex-col touch-manipulation">
                  <CardHeader className="flex-shrink-0 px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                      </div>
                      <CardTitle className="text-base sm:text-lg font-semibold">Template Management</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-grow flex flex-col justify-between px-4 sm:px-6 pb-4 sm:pb-6">
                    <p className="text-gray-600 mb-4 text-sm sm:text-base leading-relaxed">
                      Upload, manage, and organize dispatch and EOD templates for each ship with complete isolation.
                    </p>
                    <Link href="/templates" className="mt-auto">
                      <Button variant="outline" size="sm" className="w-full text-xs sm:text-sm h-9 sm:h-10 touch-manipulation">
                        Manage Templates <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 ml-2" />
                      </Button>
                    </Link>
                  </CardContent>
                </Card>

                <Card className="hover:shadow-lg active:shadow-md transition-all duration-200 h-full flex flex-col touch-manipulation">
                  <CardHeader className="flex-shrink-0 px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Clipboard className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                      </div>
                      <CardTitle className="text-base sm:text-lg font-semibold">Dispatch Records</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-grow flex flex-col justify-between px-4 sm:px-6 pb-4 sm:pb-6">
                    <p className="text-gray-600 mb-4 text-sm sm:text-base leading-relaxed">
                      Create and edit dispatch records using spreadsheet interface with real-time data processing.
                    </p>
                    <Link href="/create-dispatch" className="mt-auto">
                      <Button variant="outline" size="sm" className="w-full text-xs sm:text-sm h-9 sm:h-10 touch-manipulation">
                        Create Records <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 ml-2" />
                      </Button>
                    </Link>
                  </CardContent>
                </Card>

                <Card className="hover:shadow-lg active:shadow-md transition-all duration-200 h-full flex flex-col touch-manipulation">
                  <CardHeader className="flex-shrink-0 px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" />
                      </div>
                      <CardTitle className="text-base sm:text-lg font-semibold">Report Generation</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-grow flex flex-col justify-between px-4 sm:px-6 pb-4 sm:pb-6">
                    <p className="text-gray-600 mb-4 text-sm sm:text-base leading-relaxed">
                      Generate comprehensive dispatch and EOD reports with automated data processing and export.
                    </p>
                    <Link href="/reports" className="mt-auto">
                      <Button variant="outline" size="sm" className="w-full text-xs sm:text-sm h-9 sm:h-10 touch-manipulation">
                        View Reports <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 ml-2" />
                      </Button>
                    </Link>
                  </CardContent>
                </Card>

                <Card className="hover:shadow-lg active:shadow-md transition-all duration-200 h-full flex flex-col touch-manipulation">
                  <CardHeader className="flex-shrink-0 px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 bg-yellow-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Users className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-600" />
                      </div>
                      <CardTitle className="text-base sm:text-lg font-semibold">User Management</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-grow flex flex-col justify-between px-4 sm:px-6 pb-4 sm:pb-6">
                    <p className="text-gray-600 mb-4 text-sm sm:text-base leading-relaxed">
                      Comprehensive user management with role-based access control and profile management.
                    </p>
                    <Link href="/users" className="mt-auto">
                      <Button variant="outline" size="sm" className="w-full text-xs sm:text-sm h-9 sm:h-10 touch-manipulation">
                        Manage Users <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 ml-2" />
                      </Button>
                    </Link>
                  </CardContent>
                </Card>

                <Card className="hover:shadow-lg active:shadow-md transition-all duration-200 h-full flex flex-col touch-manipulation">
                  <CardHeader className="flex-shrink-0 px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Lock className="w-4 h-4 sm:w-5 sm:h-5 text-red-600" />
                      </div>
                      <CardTitle className="text-base sm:text-lg font-semibold">Security & Isolation</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-grow flex flex-col justify-between px-4 sm:px-6 pb-4 sm:pb-6">
                    <p className="text-gray-600 mb-4 text-sm sm:text-base leading-relaxed">
                      Advanced security features with complete data isolation between ships and role-based permissions.
                    </p>
                    <Button variant="outline" size="sm" className="w-full text-xs sm:text-sm h-9 sm:h-10 mt-auto touch-manipulation" disabled>
                      <Lock className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                      Secured System
                    </Button>
                  </CardContent>
                </Card>

                <Card className="hover:shadow-lg active:shadow-md transition-all duration-200 h-full flex flex-col touch-manipulation">
                  <CardHeader className="flex-shrink-0 px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Database className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
                      </div>
                      <CardTitle className="text-base sm:text-lg font-semibold">Data Management</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-grow flex flex-col justify-between px-4 sm:px-6 pb-4 sm:pb-6">
                    <p className="text-gray-600 mb-4 text-sm sm:text-base leading-relaxed">
                      Robust data storage and management with automated backups and version control.
                    </p>
                    <Button variant="outline" size="sm" className="w-full text-xs sm:text-sm h-9 sm:h-10 mt-auto touch-manipulation" disabled>
                      <Database className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                      System Managed
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </section>

            {/* Quick Actions */}
            <section className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 sm:p-5 md:p-6 lg:p-8">
              <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 mb-3 sm:mb-4 md:mb-6 text-center leading-tight">Quick Actions</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <Link href="/templates" className="touch-manipulation">
                  <Button className="w-full h-12 sm:h-14 lg:h-16 bg-white text-gray-700 hover:bg-gray-50 active:bg-gray-100 border border-gray-200 text-xs sm:text-sm transition-all duration-200 touch-manipulation">
                    <div className="text-center w-full">
                      <Upload className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 mx-auto mb-1 sm:mb-1.5" />
                      <div className="font-medium text-xs sm:text-sm">Upload Templates</div>
                    </div>
                  </Button>
                </Link>
                
                <Link href="/create-dispatch" className="touch-manipulation">
                  <Button className="w-full h-12 sm:h-14 lg:h-16 bg-white text-gray-700 hover:bg-gray-50 active:bg-gray-100 border border-gray-200 text-xs sm:text-sm transition-all duration-200 touch-manipulation">
                    <div className="text-center w-full">
                      <FileText className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 mx-auto mb-1 sm:mb-1.5" />
                      <div className="font-medium text-xs sm:text-sm">Create Dispatch</div>
                    </div>
                  </Button>
                </Link>
                
                <Link href="/reports" className="touch-manipulation">
                  <Button className="w-full h-12 sm:h-14 lg:h-16 bg-white text-gray-700 hover:bg-gray-50 active:bg-gray-100 border border-gray-200 text-xs sm:text-sm transition-all duration-200 touch-manipulation">
                    <div className="text-center w-full">
                      <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 mx-auto mb-1 sm:mb-1.5" />
                      <div className="font-medium text-xs sm:text-sm">View Reports</div>
                    </div>
                  </Button>
                </Link>
                
                <Link href="/users" className="touch-manipulation">
                  <Button className="w-full h-12 sm:h-14 lg:h-16 bg-white text-gray-700 hover:bg-gray-50 active:bg-gray-100 border border-gray-200 text-xs sm:text-sm transition-all duration-200 touch-manipulation">
                    <div className="text-center w-full">
                      <Users className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 mx-auto mb-1 sm:mb-1.5" />
                      <div className="font-medium text-xs sm:text-sm">Manage Users</div>
                    </div>
                  </Button>
                </Link>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}