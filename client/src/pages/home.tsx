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
              <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-4 sm:mb-6 px-2">
                Maritime Operations Management
              </h1>
              <p className="text-base sm:text-lg md:text-xl text-blue-100 mb-6 sm:mb-8 max-w-4xl mx-auto px-4">
                Advanced multi-ship dispatch and reporting system with comprehensive role-based access control
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center space-y-2 sm:space-y-0 sm:space-x-2 mb-6 sm:mb-8 px-4">
                {user && (
                  <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-2 bg-white/20 backdrop-blur-sm rounded-full px-4 py-2 border border-white/30 w-full sm:w-auto">
                    <div className="flex items-center space-x-2">
                      {getRoleIcon(user.role)}
                      <span className="text-sm font-medium">Welcome, {user.firstName}</span>
                    </div>
                    <Badge variant={getRoleBadgeVariant(user.role)} className="bg-white/20 text-white border-white/30">
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
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-4 sm:mb-6">
                Multi-Ship Management System
              </h2>
              <p className="text-base sm:text-lg text-gray-600 mb-8 sm:mb-12 max-w-4xl mx-auto px-2">
                Our system provides complete data isolation and dedicated management for three distinct vessels, 
                ensuring operational security and organizational clarity.
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
                <Card className="hover:shadow-lg transition-shadow h-full flex flex-col">
                  <CardHeader className="text-center flex-shrink-0">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                      <Ship className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600" />
                    </div>
                    <CardTitle className="text-blue-600 text-base sm:text-lg">Ship A Operations</CardTitle>
                  </CardHeader>
                  <CardContent className="flex-grow flex flex-col justify-between">
                    <p className="text-gray-600 mb-4 text-sm sm:text-base">
                      Dedicated templates, dispatch records, and reporting system for Ship A operations.
                    </p>
                    <div className="flex items-center justify-center space-x-2 mt-auto">
                      <Database className="w-4 h-4 text-gray-400" />
                      <span className="text-xs sm:text-sm text-gray-500">Isolated Data Environment</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="hover:shadow-lg transition-shadow h-full flex flex-col">
                  <CardHeader className="text-center flex-shrink-0">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                      <Ship className="w-6 h-6 sm:w-8 sm:h-8 text-green-600" />
                    </div>
                    <CardTitle className="text-green-600 text-base sm:text-lg">Ship B Operations</CardTitle>
                  </CardHeader>
                  <CardContent className="flex-grow flex flex-col justify-between">
                    <p className="text-gray-600 mb-4 text-sm sm:text-base">
                      Complete separation of Ship B data, templates, and operational workflows.
                    </p>
                    <div className="flex items-center justify-center space-x-2 mt-auto">
                      <Database className="w-4 h-4 text-gray-400" />
                      <span className="text-xs sm:text-sm text-gray-500">Isolated Data Environment</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="hover:shadow-lg transition-shadow h-full flex flex-col sm:col-span-2 lg:col-span-1">
                  <CardHeader className="text-center flex-shrink-0">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                      <Ship className="w-6 h-6 sm:w-8 sm:h-8 text-purple-600" />
                    </div>
                    <CardTitle className="text-purple-600 text-base sm:text-lg">Ship C Operations</CardTitle>
                  </CardHeader>
                  <CardContent className="flex-grow flex flex-col justify-between">
                    <p className="text-gray-600 mb-4 text-sm sm:text-base">
                      Independent management system for Ship C with dedicated resources and data storage.
                    </p>
                    <div className="flex items-center justify-center space-x-2 mt-auto">
                      <Database className="w-4 h-4 text-gray-400" />
                      <span className="text-xs sm:text-sm text-gray-500">Isolated Data Environment</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </section>

            {/* Role-Based Access Control */}
            <section className="bg-gray-100 rounded-xl p-4 sm:p-6 lg:p-8">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-4 sm:mb-6 text-center">
                Role-Based Access Control
              </h2>
              <p className="text-base sm:text-lg text-gray-600 mb-8 sm:mb-12 text-center max-w-4xl mx-auto px-2">
                Four-tier security system ensuring appropriate access levels for all users across the maritime operations platform.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
                <Card className="border-2 border-yellow-200 hover:shadow-lg transition-shadow h-full flex flex-col">
                  <CardHeader className="text-center flex-shrink-0">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                      <Crown className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-600" />
                    </div>
                    <CardTitle className="text-yellow-700 text-base sm:text-lg">Superuser</CardTitle>
                  </CardHeader>
                  <CardContent className="flex-grow">
                    <ul className="text-xs sm:text-sm text-gray-600 space-y-2">
                      <li className="flex items-center">
                        <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-yellow-400 rounded-full mr-2 flex-shrink-0"></div>
                        <span>Full system access</span>
                      </li>
                      <li className="flex items-center">
                        <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-yellow-400 rounded-full mr-2 flex-shrink-0"></div>
                        <span>User management</span>
                      </li>
                      <li className="flex items-center">
                        <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-yellow-400 rounded-full mr-2 flex-shrink-0"></div>
                        <span>All ship operations</span>
                      </li>
                      <li className="flex items-center">
                        <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-yellow-400 rounded-full mr-2 flex-shrink-0"></div>
                        <span>System configuration</span>
                      </li>
                    </ul>
                  </CardContent>
                </Card>

                <Card className="border-2 border-blue-200 hover:shadow-lg transition-shadow h-full flex flex-col">
                  <CardHeader className="text-center flex-shrink-0">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                      <Shield className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600" />
                    </div>
                    <CardTitle className="text-blue-700 text-base sm:text-lg">Admin</CardTitle>
                  </CardHeader>
                  <CardContent className="flex-grow">
                    <ul className="text-xs sm:text-sm text-gray-600 space-y-2">
                      <li className="flex items-center">
                        <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-blue-400 rounded-full mr-2 flex-shrink-0"></div>
                        <span>User management</span>
                      </li>
                      <li className="flex items-center">
                        <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-blue-400 rounded-full mr-2 flex-shrink-0"></div>
                        <span>Template management</span>
                      </li>
                      <li className="flex items-center">
                        <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-blue-400 rounded-full mr-2 flex-shrink-0"></div>
                        <span>Report generation</span>
                      </li>
                      <li className="flex items-center">
                        <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-blue-400 rounded-full mr-2 flex-shrink-0"></div>
                        <span>Ship operations</span>
                      </li>
                    </ul>
                  </CardContent>
                </Card>

                <Card className="border-2 border-green-200 hover:shadow-lg transition-shadow h-full flex flex-col">
                  <CardHeader className="text-center flex-shrink-0">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                      <Clipboard className="w-6 h-6 sm:w-8 sm:h-8 text-green-600" />
                    </div>
                    <CardTitle className="text-green-700 text-base sm:text-lg">Dispatcher</CardTitle>
                  </CardHeader>
                  <CardContent className="flex-grow">
                    <ul className="text-xs sm:text-sm text-gray-600 space-y-2">
                      <li className="flex items-center">
                        <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-400 rounded-full mr-2 flex-shrink-0"></div>
                        <span>Create dispatch records</span>
                      </li>
                      <li className="flex items-center">
                        <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-400 rounded-full mr-2 flex-shrink-0"></div>
                        <span>Edit spreadsheets</span>
                      </li>
                      <li className="flex items-center">
                        <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-400 rounded-full mr-2 flex-shrink-0"></div>
                        <span>Generate reports</span>
                      </li>
                      <li className="flex items-center">
                        <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-400 rounded-full mr-2 flex-shrink-0"></div>
                        <span>View ship data</span>
                      </li>
                    </ul>
                  </CardContent>
                </Card>

                <Card className="border-2 border-gray-200 hover:shadow-lg transition-shadow h-full flex flex-col sm:col-span-2 lg:col-span-1">
                  <CardHeader className="text-center flex-shrink-0">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                      <User className="w-6 h-6 sm:w-8 sm:h-8 text-gray-600" />
                    </div>
                    <CardTitle className="text-gray-700 text-base sm:text-lg">General User</CardTitle>
                  </CardHeader>
                  <CardContent className="flex-grow">
                    <ul className="text-xs sm:text-sm text-gray-600 space-y-2">
                      <li className="flex items-center">
                        <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-gray-400 rounded-full mr-2 flex-shrink-0"></div>
                        <span>View-only access</span>
                      </li>
                      <li className="flex items-center">
                        <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-gray-400 rounded-full mr-2 flex-shrink-0"></div>
                        <span>Read reports</span>
                      </li>
                      <li className="flex items-center">
                        <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-gray-400 rounded-full mr-2 flex-shrink-0"></div>
                        <span>Download files</span>
                      </li>
                      <li className="flex items-center">
                        <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-gray-400 rounded-full mr-2 flex-shrink-0"></div>
                        <span>View ship status</span>
                      </li>
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </section>

            {/* System Features */}
            <section>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-4 sm:mb-6 text-center">Platform Features</h2>
              <p className="text-base sm:text-lg text-gray-600 mb-8 sm:mb-12 text-center max-w-4xl mx-auto px-2">
                Comprehensive maritime operations platform with advanced features for efficient workflow management.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
                <Card className="hover:shadow-lg transition-shadow h-full flex flex-col">
                  <CardHeader className="flex-shrink-0">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                      </div>
                      <CardTitle className="text-base sm:text-lg">Template Management</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-grow flex flex-col justify-between">
                    <p className="text-gray-600 mb-4 text-sm sm:text-base">
                      Upload, manage, and organize dispatch and EOD templates for each ship with complete isolation.
                    </p>
                    <Link href="/templates" className="mt-auto">
                      <Button variant="outline" size="sm" className="w-full text-xs sm:text-sm">
                        Manage Templates <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 ml-2" />
                      </Button>
                    </Link>
                  </CardContent>
                </Card>

                <Card className="hover:shadow-lg transition-shadow h-full flex flex-col">
                  <CardHeader className="flex-shrink-0">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 bg-green-100 rounded-lg flex items-center justify-center">
                        <Clipboard className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                      </div>
                      <CardTitle className="text-base sm:text-lg">Dispatch Records</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-grow flex flex-col justify-between">
                    <p className="text-gray-600 mb-4 text-sm sm:text-base">
                      Create and edit dispatch records using spreadsheet interface with real-time data processing.
                    </p>
                    <Link href="/create-dispatch" className="mt-auto">
                      <Button variant="outline" size="sm" className="w-full text-xs sm:text-sm">
                        Create Records <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 ml-2" />
                      </Button>
                    </Link>
                  </CardContent>
                </Card>

                <Card className="hover:shadow-lg transition-shadow h-full flex flex-col">
                  <CardHeader className="flex-shrink-0">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                        <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" />
                      </div>
                      <CardTitle className="text-base sm:text-lg">Report Generation</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-grow flex flex-col justify-between">
                    <p className="text-gray-600 mb-4 text-sm sm:text-base">
                      Generate comprehensive dispatch and EOD reports with automated data processing and export.
                    </p>
                    <Link href="/reports" className="mt-auto">
                      <Button variant="outline" size="sm" className="w-full text-xs sm:text-sm">
                        View Reports <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 ml-2" />
                      </Button>
                    </Link>
                  </CardContent>
                </Card>

                <Card className="hover:shadow-lg transition-shadow h-full flex flex-col">
                  <CardHeader className="flex-shrink-0">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                        <Users className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-600" />
                      </div>
                      <CardTitle className="text-base sm:text-lg">User Management</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-grow flex flex-col justify-between">
                    <p className="text-gray-600 mb-4 text-sm sm:text-base">
                      Comprehensive user management with role-based access control and profile management.
                    </p>
                    <Link href="/users" className="mt-auto">
                      <Button variant="outline" size="sm" className="w-full text-xs sm:text-sm">
                        Manage Users <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 ml-2" />
                      </Button>
                    </Link>
                  </CardContent>
                </Card>

                <Card className="hover:shadow-lg transition-shadow h-full flex flex-col">
                  <CardHeader className="flex-shrink-0">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 bg-red-100 rounded-lg flex items-center justify-center">
                        <Lock className="w-4 h-4 sm:w-5 sm:h-5 text-red-600" />
                      </div>
                      <CardTitle className="text-base sm:text-lg">Security & Isolation</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-grow flex flex-col justify-between">
                    <p className="text-gray-600 mb-4 text-sm sm:text-base">
                      Advanced security features with complete data isolation between ships and role-based permissions.
                    </p>
                    <Button variant="outline" size="sm" className="w-full text-xs sm:text-sm mt-auto" disabled>
                      <Lock className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                      Secured System
                    </Button>
                  </CardContent>
                </Card>

                <Card className="hover:shadow-lg transition-shadow h-full flex flex-col">
                  <CardHeader className="flex-shrink-0">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                        <Database className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
                      </div>
                      <CardTitle className="text-base sm:text-lg">Data Management</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-grow flex flex-col justify-between">
                    <p className="text-gray-600 mb-4 text-sm sm:text-base">
                      Robust data storage and management with automated backups and version control.
                    </p>
                    <Button variant="outline" size="sm" className="w-full text-xs sm:text-sm mt-auto" disabled>
                      <Database className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                      System Managed
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </section>

            {/* Quick Actions */}
            <section className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 sm:p-6 lg:p-8">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-4 sm:mb-6 text-center">Quick Actions</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <Link href="/templates">
                  <Button className="w-full h-12 sm:h-14 lg:h-16 bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 text-xs sm:text-sm">
                    <div className="text-center">
                      <Upload className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 mx-auto mb-1" />
                      <div className="font-medium">Upload Templates</div>
                    </div>
                  </Button>
                </Link>
                
                <Link href="/create-dispatch">
                  <Button className="w-full h-12 sm:h-14 lg:h-16 bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 text-xs sm:text-sm">
                    <div className="text-center">
                      <FileText className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 mx-auto mb-1" />
                      <div className="font-medium">Create Dispatch</div>
                    </div>
                  </Button>
                </Link>
                
                <Link href="/reports">
                  <Button className="w-full h-12 sm:h-14 lg:h-16 bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 text-xs sm:text-sm">
                    <div className="text-center">
                      <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 mx-auto mb-1" />
                      <div className="font-medium">View Reports</div>
                    </div>
                  </Button>
                </Link>
                
                <Link href="/users">
                  <Button className="w-full h-12 sm:h-14 lg:h-16 bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 text-xs sm:text-sm">
                    <div className="text-center">
                      <Users className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 mx-auto mb-1" />
                      <div className="font-medium">Manage Users</div>
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