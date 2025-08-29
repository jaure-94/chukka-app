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
import SidebarNavigation from "@/components/sidebar-navigation";
import { useSidebar } from "@/contexts/sidebar-context";
import { cn } from "@/lib/utils";
import { Link, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";

export default function UserProfile() {
  const { user: currentUser } = useAuth();
  const { isCollapsed } = useSidebar();
  const params = useParams();
  
  // If there's an ID in the URL, fetch that user's data, otherwise use current user
  const userId = params.id;
  const isViewingOtherUser = !!userId;
  
  const { data: otherUserResponse, isLoading } = useQuery({
    queryKey: [`/api/users/${userId}`],
    queryFn: getQueryFn({}),
    enabled: isViewingOtherUser,
  });
  
  const otherUser = (otherUserResponse as any)?.user;
  
  // Use the appropriate user data
  const user = isViewingOtherUser ? otherUser : currentUser;

  if (!user || (isViewingOtherUser && isLoading)) {
    return <div>Loading...</div>;
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
    <div className="flex">
      <SidebarNavigation />
      <div className={cn(
        "flex-1 transition-all duration-300",
        isCollapsed ? "ml-16" : "ml-64"
      )}>
        <div className="p-8">
          <div className="max-w-4xl mx-auto space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  {isViewingOtherUser ? `${user.firstName} ${user.lastName}'s Profile` : 'Profile'}
                </h1>
                <p className="text-gray-600 mt-1">
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

            {/* Main Profile Card */}
            <Card>
              <CardHeader className="pb-6">
                <div className="flex items-center space-x-4">
                  <Avatar className="w-20 h-20">
                    <AvatarFallback className="bg-blue-100 text-blue-700 text-2xl font-semibold">
                      {user.firstName?.charAt(0) || 'U'}{user.lastName?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-3">
                      <h2 className="text-2xl font-bold text-gray-900">
                        {user.firstName && user.lastName 
                          ? `${user.firstName} ${user.lastName}` 
                          : user.username || 'Loading...'}
                      </h2>
                      <Badge 
                        variant={getRoleBadgeVariant(user.role)}
                        className="flex items-center space-x-1"
                      >
                        {getRoleIcon(user.role)}
                        <span className="capitalize">{user.role}</span>
                      </Badge>
                    </div>
                    <p className="text-gray-600">{user.position}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <Separator />
                
                {/* Contact Information */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                        <Mail className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Email</p>
                        <p className="font-medium text-gray-900">{user.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
                        <UserIcon className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Username</p>
                        <p className="font-medium text-gray-900">{user.username}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Work Information */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Work Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
                        <MapPin className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Position</p>
                        <p className="font-medium text-gray-900">{user.position}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-orange-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Employee Number</p>
                        <p className="font-medium text-gray-900">{user.employeeNumber}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Account Status */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Account Status</h3>
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span className="text-sm text-gray-600">Active Account</span>
                  </div>
                  <div className="mt-2 text-sm text-gray-500">
                    Account created on {new Date(user.createdAt).toLocaleDateString('en-GB')}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Security Settings Card */}
            <Card>
              <CardHeader>
                <CardTitle>Security Settings</CardTitle>
                <CardDescription>
                  Manage your account security and authentication preferences
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">Password</p>
                    <p className="text-sm text-gray-600">Last updated recently</p>
                  </div>
                  <Button variant="outline" size="sm">
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