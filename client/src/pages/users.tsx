import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SidebarNavigation, MobileNavigation } from "@/components/sidebar-navigation";
import { User, MoreVertical, Crown, Shield, Clipboard, UserIcon, Loader2 } from "lucide-react";
import { useUsers, useUserStats, type SystemUser } from "@/hooks/use-users";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useSidebar } from "@/contexts/sidebar-context";

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

const getInitials = (firstName: string, lastName: string) => {
  return `${firstName?.charAt(0) || 'U'}${lastName?.charAt(0) || 'U'}`.toUpperCase();
};

export default function Users() {
  const { isCollapsed } = useSidebar();
  const { data: users, isLoading, error } = useUsers();
  const { data: stats } = useUserStats();
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="flex">
          <div className="hidden lg:block">
            <SidebarNavigation />
          </div>
          <div className="lg:hidden">
            <MobileNavigation />
          </div>
          <main className={`flex-1 p-6 transition-all duration-300 ${
            isCollapsed ? 'lg:ml-16' : 'lg:ml-64'
          }`}>
            <div className="flex items-center justify-center min-h-[400px]">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="flex">
          <div className="hidden lg:block">
            <SidebarNavigation />
          </div>
          <div className="lg:hidden">
            <MobileNavigation />
          </div>
          <main className={`flex-1 p-6 transition-all duration-300 ${
            isCollapsed ? 'lg:ml-16' : 'lg:ml-64'
          }`}>
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="text-center">
                <h2 className="text-2xl font-semibold text-gray-900">Error Loading Users</h2>
                <p className="text-gray-600 mt-2">Unable to fetch user data. Please try again.</p>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        {/* Desktop Sidebar */}
        <div className="hidden lg:block">
          <SidebarNavigation />
        </div>

        {/* Mobile Navigation */}
        <div className="lg:hidden">
          <MobileNavigation />
        </div>

        {/* Main Content */}
        <main className={`flex-1 p-6 transition-all duration-300 ${
          isCollapsed ? 'lg:ml-16' : 'lg:ml-64'
        }`}>
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-8">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">Users</h1>
                  <p className="text-gray-600 mt-1">
                    Manage user accounts and permissions
                  </p>
                </div>
                <Button className="bg-blue-600 hover:bg-blue-700">
                  <User className="w-4 h-4 mr-2" />
                  Add New User
                </Button>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <User className="w-6 h-6 text-green-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Active Users</p>
                      <p className="text-2xl font-bold text-gray-900">{stats?.activeUsers || 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="p-2 bg-yellow-100 rounded-lg">
                      <User className="w-6 h-6 text-yellow-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Pending</p>
                      <p className="text-2xl font-bold text-gray-900">{stats?.pendingUsers || 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="p-2 bg-red-100 rounded-lg">
                      <User className="w-6 h-6 text-red-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Inactive</p>
                      <p className="text-2xl font-bold text-gray-900">{stats?.inactiveUsers || 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <User className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Total Users</p>
                      <p className="text-2xl font-bold text-gray-900">{stats?.totalUsers || 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Users Table */}
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[200px]">User</TableHead>
                        <TableHead className="min-w-[120px]">Role</TableHead>
                        <TableHead className="min-w-[150px] hidden md:table-cell">Position</TableHead>
                        <TableHead className="min-w-[200px]">Email</TableHead>
                        <TableHead className="min-w-[120px] hidden lg:table-cell">Employee #</TableHead>
                        <TableHead className="min-w-[80px]">Status</TableHead>
                        <TableHead className="min-w-[100px] hidden sm:table-cell">Join Date</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                  <TableBody>
                    {users?.map((user: SystemUser) => (
                      <TableRow key={user.id} className="hover:bg-gray-50">
                        <TableCell>
                          <div className="flex items-center space-x-3">
                            <Avatar className="h-10 w-10">
                              <AvatarFallback className="bg-blue-100 text-blue-600 font-semibold text-sm">
                                {getInitials(user.firstName, user.lastName)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium text-gray-900">
                                {user.firstName} {user.lastName}
                              </div>
                              <div className="text-sm text-gray-500">@{user.username}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Badge variant={getRoleBadgeVariant(user.role)} className="flex items-center space-x-1">
                              {getRoleIcon(user.role)}
                              <span className="capitalize">{user.role}</span>
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {user.position || 'Not specified'}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-gray-900 truncate max-w-[150px]">{user.email}</div>
                        </TableCell>
                        <TableCell className="text-sm hidden lg:table-cell">
                          {user.employeeNumber || 'N/A'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={user.isActive ? 'default' : 'secondary'}>
                            {user.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm hidden sm:table-cell">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem>View Profile</DropdownMenuItem>
                              <DropdownMenuItem>Edit User</DropdownMenuItem>
                              <DropdownMenuItem>Reset Password</DropdownMenuItem>
                              <DropdownMenuItem className="text-red-600">
                                {user.isActive ? 'Deactivate User' : 'Activate User'}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}