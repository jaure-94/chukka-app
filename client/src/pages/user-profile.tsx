import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { 
  Crown, 
  Shield, 
  Clipboard, 
  User as UserIcon, 
  Mail, 
  MapPin, 
  Calendar,
  Edit
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { SidebarNavigation, MobileNavigation } from "@/components/sidebar-navigation";
import { useSidebar } from "@/contexts/sidebar-context";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { Link, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { Breadcrumbs } from "@/components/breadcrumbs";

export default function UserProfile() {
  const { user: currentUser } = useAuth();
  const { isCollapsed } = useSidebar();
  const params = useParams();
  const isMobile = useIsMobile();
  
  // If there's an ID in the URL, fetch that user's data, otherwise use current user
  const userId = params.id;
  const isViewingOtherUser = !!userId;
  
  const { data: otherUserResponse, isLoading } = useQuery({
    queryKey: [`/api/users/${userId}`],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: isViewingOtherUser,
  });
  
  const otherUser = (otherUserResponse as any)?.user;
  
  // Use the appropriate user data
  const user = isViewingOtherUser ? otherUser : currentUser;

  if (!user || (isViewingOtherUser && isLoading)) {
    return (
      <div className="flex h-screen overflow-hidden">
        <SidebarNavigation />
        <div className={cn(
          "flex-1 transition-all duration-300 overflow-y-auto",
          isCollapsed ? "ml-16" : "ml-64",
          isMobile ? "ml-0 mt-[60px]" : ""
        )}>
          <div className="flex items-center justify-center min-h-[400px] p-4">
            <div className="text-sm sm:text-base">Loading...</div>
          </div>
        </div>
      </div>
    );
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'superuser':
        return <Crown className="w-4 h-4 text-yellow-600" />;
      case 'admin':
        return <Shield className="w-4 h-4 text-blue-600" />;
      case 'dispatcher':
        return <Clipboard className="w-4 h-4 text-green-600" />;
      default:
        return <UserIcon className="w-4 h-4 text-gray-600" />;
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
    <div className="flex h-screen overflow-hidden">
      <SidebarNavigation />
      
      {/* Mobile Header */}
      {isMobile && (
        <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 shadow-sm md:hidden">
          <div className="flex items-center justify-between px-3 sm:px-4 h-[60px]">
            <div className="flex items-center space-x-3 flex-1 min-w-0">
              <MobileNavigation />
              <div className="flex-1 min-w-0">
                <h1 className="text-base sm:text-lg font-semibold text-gray-900 truncate">
                  {isViewingOtherUser ? `${user.firstName} ${user.lastName}` : 'Profile'}
                </h1>
                <p className="text-xs text-gray-500 truncate">
                  {isViewingOtherUser ? 'User profile' : 'Account info'}
                </p>
              </div>
            </div>
            {!isViewingOtherUser && (
              <Link href="/profile/edit">
                <Button 
                  size="sm"
                  variant="outline"
                  className="h-9 px-3 flex-shrink-0"
                >
                  <Edit className="w-4 h-4" />
                </Button>
              </Link>
            )}
          </div>
        </header>
      )}

      <div className={cn(
        "flex-1 transition-all duration-300 overflow-y-auto",
        isCollapsed ? "ml-16" : "ml-64",
        isMobile ? "ml-0 mt-[60px]" : ""
      )}>
        <div className="p-3 sm:p-4 md:p-8">
          <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6 md:space-y-8">
            {/* Breadcrumbs */}
            <Breadcrumbs 
              items={
                isViewingOtherUser 
                  ? [
                      { label: "Users", href: "/users" },
                      { label: `${user.firstName} ${user.lastName}`, href: `/users/${userId}` }
                    ]
                  : [
                      { label: "Profile", href: "/profile" }
                    ]
              } 
            />
            {/* Desktop Header */}
            {!isMobile && (
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                    {isViewingOtherUser ? `${user.firstName} ${user.lastName}'s Profile` : 'Profile'}
                  </h1>
                  <p className="text-sm sm:text-base text-gray-600 mt-1">
                    {isViewingOtherUser ? 'View user account information' : 'Manage your account information'}
                  </p>
                </div>
                {!isViewingOtherUser && (
                  <Link href="/profile/edit">
                    <Button variant="outline">
                      <Edit className="w-4 h-4 mr-2" />
                      Edit Profile
                    </Button>
                  </Link>
                )}
              </div>
            )}

            {/* Main Profile Card */}
            <Card>
              <CardHeader className="pb-4 sm:pb-6 p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
                  <Avatar className="w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0">
                    <AvatarFallback className="bg-blue-100 text-blue-700 text-xl sm:text-2xl font-semibold">
                      {user.firstName?.charAt(0) || 'U'}{user.lastName?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                      <h2 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">
                        {user.firstName && user.lastName 
                          ? `${user.firstName} ${user.lastName}` 
                          : user.username || 'Loading...'}
                      </h2>
                      <Badge 
                        variant={getRoleBadgeVariant(user.role)}
                        className="flex items-center space-x-1 w-fit text-xs"
                      >
                        {getRoleIcon(user.role)}
                        <span className="capitalize">{user.role}</span>
                      </Badge>
                    </div>
                    {user.position && (
                      <p className="text-sm sm:text-base text-gray-600 truncate">{user.position}</p>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 sm:space-y-6 p-4 sm:p-6">
                <Separator />
                
                {/* Contact Information */}
                <div>
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Contact Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Mail className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs sm:text-sm text-gray-500">Email</p>
                        <p className="font-medium text-sm sm:text-base text-gray-900 truncate break-all">{user.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center flex-shrink-0">
                        <UserIcon className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs sm:text-sm text-gray-500">Username</p>
                        <p className="font-medium text-sm sm:text-base text-gray-900 truncate">{user.username}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Work Information */}
                <div>
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Work Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center flex-shrink-0">
                        <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs sm:text-sm text-gray-500">Position</p>
                        <p className="font-medium text-sm sm:text-base text-gray-900 truncate">{user.position || 'Not specified'}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs sm:text-sm text-gray-500">Employee Number</p>
                        <p className="font-medium text-sm sm:text-base text-gray-900 truncate">{user.employeeNumber || 'Not specified'}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Account Status */}
                <div>
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Account Status</h3>
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 bg-green-500 rounded-full flex-shrink-0"></div>
                    <span className="text-xs sm:text-sm text-gray-600">Active Account</span>
                  </div>
                  <div className="mt-2 text-xs sm:text-sm text-gray-500">
                    Account created on {new Date(user.createdAt).toLocaleDateString('en-GB')}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Security Settings Card */}
            <Card>
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-lg sm:text-xl">Security Settings</CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Manage your account security and authentication preferences
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 sm:p-4 bg-gray-50 rounded-lg gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm sm:text-base text-gray-900">Password</p>
                    <p className="text-xs sm:text-sm text-gray-600">Last updated recently</p>
                  </div>
                  <Button variant="outline" size="sm" className="w-full sm:w-auto h-9 sm:h-8 touch-manipulation">
                    Change Password
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}