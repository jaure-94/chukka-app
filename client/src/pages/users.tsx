import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SidebarNavigation, MobileNavigation } from "@/components/sidebar-navigation";
import { User, MoreVertical, Crown, Shield, Clipboard, UserIcon, Loader2, Trash2, AlertTriangle, CheckCircle, UserX } from "lucide-react";
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
import { useAuth } from "@/hooks/use-auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { Breadcrumbs } from "@/components/breadcrumbs";

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
  const { user: currentUser } = useAuth();
  const { data: users, isLoading, error } = useUsers();
  const { data: stats } = useUserStats();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<SystemUser | null>(null);
  const [userToDeactivate, setUserToDeactivate] = useState<SystemUser | null>(null);
  const [operationType, setOperationType] = useState<"delete" | "deactivate" | "reactivate">("deactivate");
  const [, setLocation] = useLocation();

  // Deactivate user mutation (current "delete" functionality)
  const deactivateUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      const response = await apiRequest("DELETE", `/api/users/${userId}`);
      return await response.json();
    },
    onSuccess: () => {
      // Refresh the users list and stats
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users/stats"] });
      
      // Close deactivate dialog and show success dialog
      setDeactivateDialogOpen(false);
      setOperationType("deactivate");
      setSuccessDialogOpen(true);
    },
    onError: (error: Error) => {
      toast({
        title: "Deactivation Failed",
        description: error.message || "Failed to deactivate user. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Reactivate user mutation
  const reactivateUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      const response = await apiRequest("PATCH", `/api/users/${userId}/reactivate`);
      return await response.json();
    },
    onSuccess: () => {
      // Refresh the users list and stats
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users/stats"] });
      
      // Close deactivate dialog and show success dialog
      setDeactivateDialogOpen(false);
      setOperationType("reactivate");
      setSuccessDialogOpen(true);
    },
    onError: (error: Error) => {
      toast({
        title: "Reactivation Failed",
        description: error.message || "Failed to reactivate user. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Delete user mutation (permanent deletion)
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      const response = await apiRequest("DELETE", `/api/users/${userId}/permanent`);
      return await response.json();
    },
    onSuccess: () => {
      // Refresh the users list and stats
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users/stats"] });
      
      // Close delete dialog and show success dialog
      setDeleteDialogOpen(false);
      setOperationType("delete");
      setSuccessDialogOpen(true);
    },
    onError: (error: Error) => {
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to permanently delete user. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleDeactivateClick = (user: SystemUser) => {
    setUserToDeactivate(user);
    setDeactivateDialogOpen(true);
  };

  const handleDeleteClick = (user: SystemUser) => {
    setUserToDelete(user);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDeactivate = () => {
    if (userToDeactivate) {
      // Check if user is currently active or inactive
      if (userToDeactivate.isActive) {
        // User is active, so deactivate them
        deactivateUserMutation.mutate(userToDeactivate.id);
      } else {
        // User is inactive, so reactivate them
        reactivateUserMutation.mutate(userToDeactivate.id);
      }
    }
  };

  const handleConfirmDelete = () => {
    if (userToDelete) {
      deleteUserMutation.mutate(userToDelete.id);
    }
  };

  const handleSuccessClose = () => {
    setSuccessDialogOpen(false);
    setUserToDelete(null);
    setUserToDeactivate(null);
  };
  
  if (isLoading) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <SidebarNavigation />
        <main className={`flex-1 transition-all duration-300 ${
          isCollapsed ? 'ml-16' : 'ml-64'
        } ${isMobile ? 'ml-0 mt-[60px]' : ''} overflow-hidden`}>
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
        } ${isMobile ? 'ml-0 mt-[60px]' : ''} overflow-hidden`}>
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center px-4">
              <h2 className="text-xl sm:text-2xl font-semibold text-gray-900">Error Loading Users</h2>
              <p className="text-sm sm:text-base text-gray-600 mt-2">Unable to fetch user data. Please try again.</p>
            </div>
          </div>
        </main>
      </div>
    );
  }
  
  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <SidebarNavigation />
      
      {/* Mobile Header */}
      {isMobile && (
        <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 shadow-sm md:hidden">
          <div className="flex items-center justify-between px-3 sm:px-4 h-[60px]">
            <div className="flex items-center space-x-3 flex-1 min-w-0">
              <MobileNavigation />
              <div className="flex-1 min-w-0">
                <h1 className="text-base sm:text-lg font-semibold text-gray-900 truncate">Users</h1>
                <p className="text-xs text-gray-500 truncate">Manage accounts</p>
              </div>
            </div>
            {currentUser?.role === 'superuser' && (
              <Button 
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 h-9 px-3 flex-shrink-0"
                onClick={() => setLocation("/create-user")}
              >
                <User className="w-4 h-4 sm:mr-1.5" />
                <span className="hidden sm:inline">Create</span>
              </Button>
            )}
          </div>
        </header>
      )}

      {/* Main Content */}
      <main className={`flex-1 transition-all duration-300 ${
        isCollapsed ? 'ml-16' : 'ml-64'
      } ${isMobile ? 'ml-0 mt-[60px]' : ''} flex flex-col`}>
        {/* Breadcrumbs */}
        <Breadcrumbs />
        <div className="flex-1 overflow-y-auto">
          <div className="p-3 sm:p-4 md:p-6">
          <div className="w-full max-w-full">
            {/* Desktop Header */}
            {!isMobile && (
              <div className="mb-6 md:mb-8">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Users</h1>
                    <p className="text-sm sm:text-base text-gray-600 mt-1">
                      Manage user accounts and permissions
                    </p>
                  </div>
                  {currentUser?.role === 'superuser' && (
                    <Button 
                      className="bg-blue-600 hover:bg-blue-700"
                      onClick={() => setLocation("/create-user")}
                    >
                      <User className="w-4 h-4 mr-2" />
                      Create New User
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Stats Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 md:gap-6 mb-6 md:mb-8">
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-3 sm:p-4 md:p-6">
                  <div className="flex items-center">
                    <div className="p-1.5 sm:p-2 bg-green-100 rounded-lg flex-shrink-0">
                      <User className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-green-600" />
                    </div>
                    <div className="ml-2 sm:ml-3 md:ml-4 min-w-0 flex-1">
                      <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">Active Users</p>
                      <p className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900">{stats?.activeUsers || 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-3 sm:p-4 md:p-6">
                  <div className="flex items-center">
                    <div className="p-1.5 sm:p-2 bg-yellow-100 rounded-lg flex-shrink-0">
                      <User className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-yellow-600" />
                    </div>
                    <div className="ml-2 sm:ml-3 md:ml-4 min-w-0 flex-1">
                      <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">Pending</p>
                      <p className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900">{stats?.pendingUsers || 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-3 sm:p-4 md:p-6">
                  <div className="flex items-center">
                    <div className="p-1.5 sm:p-2 bg-red-100 rounded-lg flex-shrink-0">
                      <User className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-red-600" />
                    </div>
                    <div className="ml-2 sm:ml-3 md:ml-4 min-w-0 flex-1">
                      <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">Inactive</p>
                      <p className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900">{stats?.inactiveUsers || 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-3 sm:p-4 md:p-6">
                  <div className="flex items-center">
                    <div className="p-1.5 sm:p-2 bg-blue-100 rounded-lg flex-shrink-0">
                      <User className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-blue-600" />
                    </div>
                    <div className="ml-2 sm:ml-3 md:ml-4 min-w-0 flex-1">
                      <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">Total Users</p>
                      <p className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900">{stats?.totalUsers || 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Users Table - Desktop */}
            {!isMobile && (
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
                                  <DropdownMenuItem onClick={() => setLocation(`/users/${user.id}`)}>
                                    View Profile
                                  </DropdownMenuItem>
                                  {/* Admin users can only view superuser profiles, not edit them */}
                                  {!(currentUser?.role === 'admin' && user.role === 'superuser') && (
                                    <>
                                      <DropdownMenuItem onClick={() => setLocation(`/users/${user.id}/edit`)}>
                                        Edit User
                                      </DropdownMenuItem>
                                      <DropdownMenuItem>Reset Password</DropdownMenuItem>
                                      {/* Prevent superuser from being deactivated or deleted */}
                                      {user.role !== 'superuser' && (
                                        <>
                                          {/* Admin users cannot deactivate other admin users */}
                                          {!(currentUser?.role === 'admin' && user.role === 'admin') && (
                                            <DropdownMenuItem 
                                              className="text-orange-600"
                                              onClick={() => handleDeactivateClick(user)}
                                            >
                                              <UserX className="w-4 h-4 mr-2" />
                                              {user.isActive ? 'Deactivate User' : 'Reactivate User'}
                                            </DropdownMenuItem>
                                          )}
                                          {/* Only superusers can permanently delete users */}
                                          {currentUser?.role === 'superuser' && (
                                            <DropdownMenuItem 
                                              className="text-red-600 focus:text-red-600" 
                                              onClick={() => handleDeleteClick(user)}
                                            >
                                              <Trash2 className="w-4 h-4 mr-2" />
                                              Delete Permanently
                                            </DropdownMenuItem>
                                          )}
                                        </>
                                      )}
                                    </>
                                  )}
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
            )}

            {/* Users Cards - Mobile */}
            {isMobile && (
              <div className="space-y-3">
                {(users || []).map((user: SystemUser) => (
                  <Card key={user.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3 flex-1 min-w-0">
                          <Avatar className="h-12 w-12 flex-shrink-0">
                            <AvatarFallback className="bg-blue-100 text-blue-600 font-semibold text-sm">
                              {getInitials(user.firstName, user.lastName)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2 mb-1">
                              <h3 className="font-semibold text-gray-900 text-sm sm:text-base truncate">
                                {user.firstName} {user.lastName}
                              </h3>
                            </div>
                            <p className="text-xs text-gray-500 mb-2">@{user.username}</p>
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <Badge variant={getRoleBadgeVariant(user.role)} className="flex items-center space-x-1 text-xs">
                                {getRoleIcon(user.role)}
                                <span className="capitalize">{user.role}</span>
                              </Badge>
                              <Badge variant={user.isActive ? 'default' : 'secondary'} className="text-xs">
                                {user.isActive ? 'Active' : 'Inactive'}
                              </Badge>
                            </div>
                            <div className="space-y-1 text-xs text-gray-600">
                              {user.position && (
                                <p className="truncate">
                                  <span className="font-medium">Position:</span> {user.position}
                                </p>
                              )}
                              <p className="truncate break-all">
                                <span className="font-medium">Email:</span> {user.email}
                              </p>
                              {user.employeeNumber && (
                                <p className="truncate">
                                  <span className="font-medium">Employee #:</span> {user.employeeNumber}
                                </p>
                              )}
                              <p className="truncate">
                                <span className="font-medium">Joined:</span> {new Date(user.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-9 w-9 p-0 flex-shrink-0 touch-manipulation">
                              <MoreVertical className="w-5 h-5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem 
                              onClick={() => setLocation(`/users/${user.id}`)}
                              className="h-11 text-sm touch-manipulation"
                            >
                              View Profile
                            </DropdownMenuItem>
                            {/* Admin users can only view superuser profiles, not edit them */}
                            {!(currentUser?.role === 'admin' && user.role === 'superuser') && (
                              <>
                                <DropdownMenuItem 
                                  onClick={() => setLocation(`/users/${user.id}/edit`)}
                                  className="h-11 text-sm touch-manipulation"
                                >
                                  Edit User
                                </DropdownMenuItem>
                                <DropdownMenuItem className="h-11 text-sm touch-manipulation">
                                  Reset Password
                                </DropdownMenuItem>
                                {/* Prevent superuser from being deactivated or deleted */}
                                {user.role !== 'superuser' && (
                                  <>
                                    {/* Admin users cannot deactivate other admin users */}
                                    {!(currentUser?.role === 'admin' && user.role === 'admin') && (
                                      <DropdownMenuItem 
                                        className="text-orange-600 h-11 text-sm touch-manipulation"
                                        onClick={() => handleDeactivateClick(user)}
                                      >
                                        <UserX className="w-4 h-4 mr-2" />
                                        {user.isActive ? 'Deactivate User' : 'Reactivate User'}
                                      </DropdownMenuItem>
                                    )}
                                    {/* Only superusers can permanently delete users */}
                                    {currentUser?.role === 'superuser' && (
                                      <DropdownMenuItem 
                                        className="text-red-600 focus:text-red-600 h-11 text-sm touch-manipulation" 
                                        onClick={() => handleDeleteClick(user)}
                                      >
                                        <Trash2 className="w-4 h-4 mr-2" />
                                        Delete Permanently
                                      </DropdownMenuItem>
                                    )}
                                  </>
                                )}
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Deactivate Confirmation Dialog */}
          <Dialog open={deactivateDialogOpen} onOpenChange={setDeactivateDialogOpen}>
            <DialogContent className="w-[calc(100%-2rem)] sm:w-full sm:max-w-[425px] mx-4 sm:mx-auto max-h-[90vh] overflow-y-auto p-4 sm:p-6">
              <DialogHeader>
                <DialogTitle className="flex items-center flex-wrap gap-2 text-orange-600 text-lg sm:text-xl">
                  <UserX className="w-5 h-5 flex-shrink-0" />
                  <span className="break-words">Confirm User {userToDeactivate?.isActive ? 'Deactivation' : 'Reactivation'}</span>
                </DialogTitle>
                <DialogDescription className="text-gray-600 mt-4 text-sm sm:text-base break-words">
                  Are you sure you want to {userToDeactivate?.isActive ? 'deactivate' : 'reactivate'} <strong>{userToDeactivate?.firstName} {userToDeactivate?.lastName}</strong> 
                  (@{userToDeactivate?.username})?
                  <br /><br />
                  {userToDeactivate?.isActive ? 
                    'The user will lose access to the system but their data will be preserved.' :
                    'The user will regain access to the system with their previous permissions.'
                  }
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-2 mt-6">
                <Button
                  variant="outline"
                  onClick={() => setDeactivateDialogOpen(false)}
                  disabled={deactivateUserMutation.isPending || reactivateUserMutation.isPending}
                  className="w-full sm:w-auto h-11 text-sm sm:text-base touch-manipulation"
                >
                  Cancel
                </Button>
                <Button
                  variant={userToDeactivate?.isActive ? "secondary" : "default"}
                  onClick={handleConfirmDeactivate}
                  disabled={deactivateUserMutation.isPending || reactivateUserMutation.isPending}
                  className={`w-full sm:w-auto h-11 text-sm sm:text-base touch-manipulation ${userToDeactivate?.isActive ? "bg-orange-600 hover:bg-orange-700 text-white" : "bg-green-600 hover:bg-green-700"}`}
                >
                  {(deactivateUserMutation.isPending || reactivateUserMutation.isPending) ? (
                    <>
                      <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span className="min-w-0 truncate">{userToDeactivate?.isActive ? 'Deactivating...' : 'Reactivating...'}</span>
                    </>
                  ) : (
                    <>
                      <UserX className="w-4 h-4 mr-2 flex-shrink-0" />
                      <span className="min-w-0 truncate">{userToDeactivate?.isActive ? 'Deactivate User' : 'Reactivate User'}</span>
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Delete Confirmation Dialog */}
          <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <DialogContent className="w-[calc(100%-2rem)] sm:w-full sm:max-w-[425px] mx-4 sm:mx-auto max-h-[90vh] overflow-y-auto p-4 sm:p-6">
              <DialogHeader>
                <DialogTitle className="flex items-center flex-wrap gap-2 text-red-600 text-lg sm:text-xl">
                  <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                  <span className="break-words">Confirm Permanent Deletion</span>
                </DialogTitle>
                <DialogDescription className="text-gray-600 mt-4 text-sm sm:text-base break-words">
                  <div className="bg-red-50 border border-red-200 rounded p-3 mb-4">
                    <strong className="text-red-800 text-sm sm:text-base break-words">⚠️ WARNING: This action is irreversible!</strong>
                  </div>
                  Are you sure you want to permanently delete <strong>{userToDelete?.firstName} {userToDelete?.lastName}</strong> 
                  (@{userToDelete?.username})?
                  <br /><br />
                  This will completely remove the user and all their associated data from the database. This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-2 mt-6">
                <Button
                  variant="outline"
                  onClick={() => setDeleteDialogOpen(false)}
                  disabled={deleteUserMutation.isPending}
                  className="w-full sm:w-auto h-11 text-sm sm:text-base touch-manipulation"
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleConfirmDelete}
                  disabled={deleteUserMutation.isPending}
                  className="bg-red-600 hover:bg-red-700 w-full sm:w-auto h-11 text-sm sm:text-base touch-manipulation"
                >
                  {deleteUserMutation.isPending ? (
                    <>
                      <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span className="min-w-0 truncate">Deleting Permanently...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4 mr-2 flex-shrink-0" />
                      <span className="min-w-0 truncate">Delete Permanently</span>
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Success Dialog */}
          <Dialog open={successDialogOpen} onOpenChange={setSuccessDialogOpen}>
            <DialogContent className="w-[calc(100%-2rem)] sm:w-full sm:max-w-[425px] mx-4 sm:mx-auto max-h-[90vh] overflow-y-auto p-4 sm:p-6">
              <DialogHeader>
                <DialogTitle className="flex items-center flex-wrap gap-2 text-green-600 text-lg sm:text-xl">
                  <CheckCircle className="w-5 h-5 flex-shrink-0" />
                  <span className="break-words">
                    {operationType === "delete" 
                      ? "User Deleted Permanently" 
                      : userToDeactivate?.isActive === false 
                        ? "User Reactivated Successfully"
                        : "User Deactivated Successfully"
                    }
                  </span>
                </DialogTitle>
                <DialogDescription className="text-gray-600 mt-4 text-sm sm:text-base break-words">
                  <strong>
                    {operationType === "delete" 
                      ? userToDelete?.firstName + " " + userToDelete?.lastName
                      : userToDeactivate?.firstName + " " + userToDeactivate?.lastName
                    }
                  </strong> has been successfully {" "}
                  {operationType === "delete" 
                    ? "permanently removed from the system"
                    : userToDeactivate?.isActive === false 
                      ? "reactivated and now has access to the system"
                      : "deactivated and no longer has access to the system"
                  }. The user list has been updated to reflect this change.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="mt-6">
                <Button
                  onClick={handleSuccessClose}
                  className="bg-green-600 hover:bg-green-700 w-full h-11 text-sm sm:text-base touch-manipulation"
                >
                  <CheckCircle className="w-4 h-4 mr-2 flex-shrink-0" />
                  <span className="min-w-0 truncate">Continue</span>
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          </div>
        </div>
      </main>
    </div>
  );
}