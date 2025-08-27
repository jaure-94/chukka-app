import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SidebarNavigation, MobileNavigation } from "@/components/sidebar-navigation";
import { User, MoreVertical, Crown, Shield, Clipboard, UserIcon, Loader2, Trash2, AlertTriangle, CheckCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useUsers, useUserStats, type SystemUser } from "@/hooks/use-users";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
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
import { useLocation } from "wouter";

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
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<SystemUser | null>(null);
  const [, setLocation] = useLocation();

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      const response = await apiRequest("DELETE", `/api/users/${userId}`);
      return await response.json();
    },
    onSuccess: () => {
      // Refresh the users list and stats
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users/stats"] });
      
      // Close delete dialog and show success dialog
      setDeleteDialogOpen(false);
      setSuccessDialogOpen(true);
    },
    onError: (error: Error) => {
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete user. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleDeleteClick = (user: SystemUser) => {
    setUserToDelete(user);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (userToDelete) {
      deleteUserMutation.mutate(userToDelete.id);
    }
  };

  const handleSuccessClose = () => {
    setSuccessDialogOpen(false);
    setUserToDelete(null);
  };
  
  if (isLoading) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <SidebarNavigation />
        <main className={`flex-1 transition-all duration-300 ${
          isCollapsed ? 'ml-16' : 'ml-64'
        } overflow-hidden`}>
          <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <SidebarNavigation />
        <main className={`flex-1 transition-all duration-300 ${
          isCollapsed ? 'ml-16' : 'ml-64'
        } overflow-hidden`}>
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <h2 className="text-2xl font-semibold text-gray-900">Error Loading Users</h2>
              <p className="text-gray-600 mt-2">Unable to fetch user data. Please try again.</p>
            </div>
          </div>
        </main>
      </div>
    );
  }
  
  return (
    <div className="flex min-h-screen bg-gray-50">
      <SidebarNavigation />
      
      {/* Main Content */}
      <main className={`flex-1 transition-all duration-300 ${
        isCollapsed ? 'ml-16' : 'ml-64'
      } overflow-hidden`}>
        <div className="p-6 h-full overflow-y-auto">
          <div className="w-full max-w-full">
            {/* Header */}
            <div className="mb-8">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">Users</h1>
                  <p className="text-gray-600 mt-1">
                    Manage user accounts and permissions
                  </p>
                </div>
                <Button 
                  className="bg-blue-600 hover:bg-blue-700"
                  onClick={() => setLocation("/create-user")}
                >
                  <User className="w-4 h-4 mr-2" />
                  Create New User
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
                        <TableHead className="w-[200px]">User</TableHead>
                        <TableHead className="w-[120px]">Role</TableHead>
                        <TableHead className="w-[150px] hidden md:table-cell">Position</TableHead>
                        <TableHead className="w-[180px] hidden lg:table-cell">Email</TableHead>
                        <TableHead className="w-[120px] hidden lg:table-cell">Employee #</TableHead>
                        <TableHead className="w-[80px]">Status</TableHead>
                        <TableHead className="w-[100px] hidden sm:table-cell">Join Date</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                  <TableBody>
                    {(users || []).map((user: SystemUser) => (
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
                        <TableCell className="hidden lg:table-cell">
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
                              <DropdownMenuItem className="text-orange-600">
                                {user.isActive ? 'Deactivate User' : 'Activate User'}
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                className="text-red-600 focus:text-red-600" 
                                onClick={() => handleDeleteClick(user)}
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete User
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

          {/* Delete Confirmation Dialog */}
          <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle className="flex items-center space-x-2 text-red-600">
                  <AlertTriangle className="w-5 h-5" />
                  <span>Confirm Delete User</span>
                </DialogTitle>
                <DialogDescription className="text-gray-600 mt-4">
                  Are you sure you want to delete <strong>{userToDelete?.firstName} {userToDelete?.lastName}</strong> 
                  (@{userToDelete?.username})? This action cannot be undone.
                  <br /><br />
                  The user will permanently lose access to the system and all associated data will be removed.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="flex space-x-2 mt-6">
                <Button
                  variant="outline"
                  onClick={() => setDeleteDialogOpen(false)}
                  disabled={deleteUserMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleConfirmDelete}
                  disabled={deleteUserMutation.isPending}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {deleteUserMutation.isPending ? (
                    <>
                      <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete User
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Success Dialog */}
          <Dialog open={successDialogOpen} onOpenChange={setSuccessDialogOpen}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle className="flex items-center space-x-2 text-green-600">
                  <CheckCircle className="w-5 h-5" />
                  <span>User Deleted Successfully</span>
                </DialogTitle>
                <DialogDescription className="text-gray-600 mt-4">
                  <strong>{userToDelete?.firstName} {userToDelete?.lastName}</strong> has been successfully 
                  removed from the system. The user list has been updated to reflect this change.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="mt-6">
                <Button
                  onClick={handleSuccessClose}
                  className="bg-green-600 hover:bg-green-700 w-full"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Continue
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </main>
    </div>
  );
}