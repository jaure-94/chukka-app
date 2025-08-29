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
    <div className="h-screen bg-gray-50 flex overflow-hidden">
      {/* Fixed Desktop Sidebar */}
      <div className="hidden md:block fixed left-0 top-0 h-full z-10">
        <SidebarNavigation />
      </div>

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col transition-all duration-300 overflow-y-auto ${
        isCollapsed ? 'md:ml-16' : 'md:ml-64'
      }`}>
        {/* Header */}
        <header className="bg-gradient-to-r from-blue-600 to-blue-800 text-white">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="py-16 text-center">
              <div className="flex items-center justify-start mb-6 md:hidden">
                <MobileNavigation />
              </div>
              <h1 className="text-5xl font-bold mb-6">Maritime Operations Management</h1>
              <p className="text-xl text-blue-100 mb-8 max-w-4xl mx-auto">
                Advanced multi-ship dispatch and reporting system with comprehensive role-based access control
              </p>
              <div className="flex items-center justify-center space-x-2 mb-8">
                {user && (
                  <>
                    <div className="flex items-center space-x-2 bg-white/20 backdrop-blur-sm rounded-full px-4 py-2 border border-white/30">
                      {getRoleIcon(user.role)}
                      <span className="text-sm font-medium">Welcome, {user.firstName}</span>
                      <Badge variant={getRoleBadgeVariant(user.role)} className="bg-white/20 text-white border-white/30">
                        {user.role}
                      </Badge>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-12 overflow-y-auto">
          <div className="max-w-7xl mx-auto space-y-16">
            {/* Three Ship System Overview */}
            <section className="text-center">
              <h2 className="text-3xl font-bold text-gray-900 mb-6">Multi-Ship Management System</h2>
              <p className="text-lg text-gray-600 mb-12 max-w-4xl mx-auto">
                Our system provides complete data isolation and dedicated management for three distinct vessels, 
                ensuring operational security and organizational clarity.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <Card className="hover:shadow-lg transition-shadow">
                  <CardHeader className="text-center">
                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Ship className="w-8 h-8 text-blue-600" />
                    </div>
                    <CardTitle className="text-blue-600">Ship A Operations</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600 mb-4">
                      Dedicated templates, dispatch records, and reporting system for Ship A operations.
                    </p>
                    <div className="flex items-center justify-center space-x-2">
                      <Database className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-500">Isolated Data Environment</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="hover:shadow-lg transition-shadow">
                  <CardHeader className="text-center">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Ship className="w-8 h-8 text-green-600" />
                    </div>
                    <CardTitle className="text-green-600">Ship B Operations</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600 mb-4">
                      Complete separation of Ship B data, templates, and operational workflows.
                    </p>
                    <div className="flex items-center justify-center space-x-2">
                      <Database className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-500">Isolated Data Environment</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="hover:shadow-lg transition-shadow">
                  <CardHeader className="text-center">
                    <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Ship className="w-8 h-8 text-purple-600" />
                    </div>
                    <CardTitle className="text-purple-600">Ship C Operations</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600 mb-4">
                      Independent management system for Ship C with dedicated resources and data storage.
                    </p>
                    <div className="flex items-center justify-center space-x-2">
                      <Database className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-500">Isolated Data Environment</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </section>

            {/* Role-Based Access Control */}
            <section className="bg-gray-100 rounded-xl p-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-6 text-center">Role-Based Access Control</h2>
              <p className="text-lg text-gray-600 mb-12 text-center max-w-4xl mx-auto">
                Four-tier security system ensuring appropriate access levels for all users across the maritime operations platform.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                <Card className="border-2 border-yellow-200 hover:shadow-lg transition-shadow">
                  <CardHeader className="text-center">
                    <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Crown className="w-8 h-8 text-yellow-600" />
                    </div>
                    <CardTitle className="text-yellow-700">Superuser</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="text-sm text-gray-600 space-y-2">
                      <li className="flex items-center">
                        <div className="w-2 h-2 bg-yellow-400 rounded-full mr-2"></div>
                        Full system access
                      </li>
                      <li className="flex items-center">
                        <div className="w-2 h-2 bg-yellow-400 rounded-full mr-2"></div>
                        User management
                      </li>
                      <li className="flex items-center">
                        <div className="w-2 h-2 bg-yellow-400 rounded-full mr-2"></div>
                        All ship operations
                      </li>
                      <li className="flex items-center">
                        <div className="w-2 h-2 bg-yellow-400 rounded-full mr-2"></div>
                        System configuration
                      </li>
                    </ul>
                  </CardContent>
                </Card>

                <Card className="border-2 border-blue-200 hover:shadow-lg transition-shadow">
                  <CardHeader className="text-center">
                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Shield className="w-8 h-8 text-blue-600" />
                    </div>
                    <CardTitle className="text-blue-700">Admin</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="text-sm text-gray-600 space-y-2">
                      <li className="flex items-center">
                        <div className="w-2 h-2 bg-blue-400 rounded-full mr-2"></div>
                        User management
                      </li>
                      <li className="flex items-center">
                        <div className="w-2 h-2 bg-blue-400 rounded-full mr-2"></div>
                        Template management
                      </li>
                      <li className="flex items-center">
                        <div className="w-2 h-2 bg-blue-400 rounded-full mr-2"></div>
                        Report generation
                      </li>
                      <li className="flex items-center">
                        <div className="w-2 h-2 bg-blue-400 rounded-full mr-2"></div>
                        Ship operations
                      </li>
                    </ul>
                  </CardContent>
                </Card>

                <Card className="border-2 border-green-200 hover:shadow-lg transition-shadow">
                  <CardHeader className="text-center">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Clipboard className="w-8 h-8 text-green-600" />
                    </div>
                    <CardTitle className="text-green-700">Dispatcher</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="text-sm text-gray-600 space-y-2">
                      <li className="flex items-center">
                        <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
                        Create dispatch records
                      </li>
                      <li className="flex items-center">
                        <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
                        Edit spreadsheets
                      </li>
                      <li className="flex items-center">
                        <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
                        Generate reports
                      </li>
                      <li className="flex items-center">
                        <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
                        View ship data
                      </li>
                    </ul>
                  </CardContent>
                </Card>

                <Card className="border-2 border-gray-200 hover:shadow-lg transition-shadow">
                  <CardHeader className="text-center">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <User className="w-8 h-8 text-gray-600" />
                    </div>
                    <CardTitle className="text-gray-700">General User</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="text-sm text-gray-600 space-y-2">
                      <li className="flex items-center">
                        <div className="w-2 h-2 bg-gray-400 rounded-full mr-2"></div>
                        View-only access
                      </li>
                      <li className="flex items-center">
                        <div className="w-2 h-2 bg-gray-400 rounded-full mr-2"></div>
                        Read reports
                      </li>
                      <li className="flex items-center">
                        <div className="w-2 h-2 bg-gray-400 rounded-full mr-2"></div>
                        Download files
                      </li>
                      <li className="flex items-center">
                        <div className="w-2 h-2 bg-gray-400 rounded-full mr-2"></div>
                        View ship status
                      </li>
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </section>

            {/* System Features */}
            <section>
              <h2 className="text-3xl font-bold text-gray-900 mb-6 text-center">Platform Features</h2>
              <p className="text-lg text-gray-600 mb-12 text-center max-w-4xl mx-auto">
                Comprehensive maritime operations platform with advanced features for efficient workflow management.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                <Card className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <FileText className="w-5 h-5 text-blue-600" />
                      </div>
                      <CardTitle>Template Management</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600 mb-4">
                      Upload, manage, and organize dispatch and EOD templates for each ship with complete isolation.
                    </p>
                    <Link href="/templates">
                      <Button variant="outline" size="sm" className="w-full">
                        Manage Templates <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </Link>
                  </CardContent>
                </Card>

                <Card className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                        <Clipboard className="w-5 h-5 text-green-600" />
                      </div>
                      <CardTitle>Dispatch Records</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600 mb-4">
                      Create and edit dispatch records using spreadsheet interface with real-time data processing.
                    </p>
                    <Link href="/create-dispatch">
                      <Button variant="outline" size="sm" className="w-full">
                        Create Records <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </Link>
                  </CardContent>
                </Card>

                <Card className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                        <BarChart3 className="w-5 h-5 text-purple-600" />
                      </div>
                      <CardTitle>Report Generation</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600 mb-4">
                      Generate comprehensive dispatch and EOD reports with automated data processing and export.
                    </p>
                    <Link href="/reports">
                      <Button variant="outline" size="sm" className="w-full">
                        View Reports <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </Link>
                  </CardContent>
                </Card>

                <Card className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                        <Users className="w-5 h-5 text-yellow-600" />
                      </div>
                      <CardTitle>User Management</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600 mb-4">
                      Comprehensive user management with role-based access control and profile management.
                    </p>
                    <Link href="/users">
                      <Button variant="outline" size="sm" className="w-full">
                        Manage Users <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </Link>
                  </CardContent>
                </Card>

                <Card className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                        <Lock className="w-5 h-5 text-red-600" />
                      </div>
                      <CardTitle>Security & Isolation</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600 mb-4">
                      Advanced security features with complete data isolation between ships and role-based permissions.
                    </p>
                    <Button variant="outline" size="sm" className="w-full" disabled>
                      <Lock className="w-4 h-4 mr-2" />
                      Secured System
                    </Button>
                  </CardContent>
                </Card>

                <Card className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                        <Database className="w-5 h-5 text-gray-600" />
                      </div>
                      <CardTitle>Data Management</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600 mb-4">
                      Robust data storage and management with automated backups and version control.
                    </p>
                    <Button variant="outline" size="sm" className="w-full" disabled>
                      <Database className="w-4 h-4 mr-2" />
                      System Managed
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </section>

            {/* Quick Actions */}
            <section className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-6 text-center">Quick Actions</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Link href="/templates">
                  <Button className="w-full h-16 bg-white text-gray-700 hover:bg-gray-50 border border-gray-200">
                    <div className="text-center">
                      <Upload className="w-6 h-6 mx-auto mb-1" />
                      <div className="text-sm font-medium">Upload Templates</div>
                    </div>
                  </Button>
                </Link>
                
                <Link href="/create-dispatch">
                  <Button className="w-full h-16 bg-white text-gray-700 hover:bg-gray-50 border border-gray-200">
                    <div className="text-center">
                      <FileText className="w-6 h-6 mx-auto mb-1" />
                      <div className="text-sm font-medium">Create Dispatch</div>
                    </div>
                  </Button>
                </Link>
                
                <Link href="/reports">
                  <Button className="w-full h-16 bg-white text-gray-700 hover:bg-gray-50 border border-gray-200">
                    <div className="text-center">
                      <BarChart3 className="w-6 h-6 mx-auto mb-1" />
                      <div className="text-sm font-medium">View Reports</div>
                    </div>
                  </Button>
                </Link>
                
                <Link href="/users">
                  <Button className="w-full h-16 bg-white text-gray-700 hover:bg-gray-50 border border-gray-200">
                    <div className="text-center">
                      <Users className="w-6 h-6 mx-auto mb-1" />
                      <div className="text-sm font-medium">Manage Users</div>
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