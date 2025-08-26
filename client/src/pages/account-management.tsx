import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SidebarNavigation, MobileNavigation } from "@/components/sidebar-navigation";
import { useSidebar } from "@/contexts/sidebar-context";
import { Loader2, Plus, Edit, Trash2, Shield, User, Mail, Building, Hash, Calendar, CheckCircle, XCircle, Search } from "lucide-react";

const createUserSchema = z.object({
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  lastName: z.string().min(2, "Last name must be at least 2 characters"),
  username: z.string().min(3, "Username must be at least 3 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["superuser", "admin", "manager", "supervisor", "user"]),
  position: z.string().optional(),
  employeeNumber: z.string().optional(),
});

const editUserSchema = createUserSchema.omit({ password: true });

type CreateUserForm = z.infer<typeof createUserSchema>;
type EditUserForm = z.infer<typeof editUserSchema>;

interface User {
  id: number;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  role: "superuser" | "admin" | "manager" | "supervisor" | "user";
  position?: string;
  employeeNumber?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function AccountManagement() {
  const { isCollapsed } = useSidebar();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Mock users data - TODO: Replace with actual API call
  const mockUsers: User[] = [
    {
      id: 1,
      firstName: "System",
      lastName: "Administrator",
      username: "admin",
      email: "admin@company.com",
      role: "superuser",
      position: "System Administrator",
      employeeNumber: "ADMIN001",
      isActive: true,
      createdAt: "2025-08-26T15:12:55.871Z",
      updatedAt: "2025-08-26T15:12:55.871Z",
    },
    // Additional mock users for demonstration
    {
      id: 2,
      firstName: "John",
      lastName: "Smith",
      username: "jsmith",
      email: "john.smith@company.com",
      role: "manager",
      position: "Fleet Manager",
      employeeNumber: "MGR001",
      isActive: true,
      createdAt: "2025-08-20T10:30:00.000Z",
      updatedAt: "2025-08-20T10:30:00.000Z",
    },
    {
      id: 3,
      firstName: "Sarah",
      lastName: "Johnson",
      username: "sjohnson",
      email: "sarah.johnson@company.com",
      role: "supervisor",
      position: "Operations Supervisor",
      employeeNumber: "SUP001",
      isActive: true,
      createdAt: "2025-08-18T14:15:00.000Z",
      updatedAt: "2025-08-25T09:45:00.000Z",
    },
  ];

  const createForm = useForm<CreateUserForm>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      role: "user",
    },
  });

  const editForm = useForm<EditUserForm>({
    resolver: zodResolver(editUserSchema),
  });

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "superuser":
        return "destructive";
      case "admin":
        return "default";
      case "manager":
        return "secondary";
      case "supervisor":
        return "outline";
      default:
        return "outline";
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "superuser":
      case "admin":
        return <Shield className="w-3 h-3" />;
      case "manager":
        return <Building className="w-3 h-3" />;
      default:
        return <User className="w-3 h-3" />;
    }
  };

  const filteredUsers = mockUsers.filter(user => {
    const matchesSearch = 
      user.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = roleFilter === "all" || user.role === roleFilter;
    
    return matchesSearch && matchesRole;
  });

  const onCreateSubmit = async (data: CreateUserForm) => {
    setIsLoading(true);
    setError(null);
    
    try {
      // TODO: Connect to actual create user API
      console.log("Creating user:", data);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setSuccess("User created successfully");
      setIsCreateDialogOpen(false);
      createForm.reset();
    } catch (err) {
      setError("Failed to create user. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const onEditSubmit = async (data: EditUserForm) => {
    setIsLoading(true);
    setError(null);
    
    try {
      // TODO: Connect to actual edit user API
      console.log("Editing user:", selectedUser?.id, data);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setSuccess("User updated successfully");
      setIsEditDialogOpen(false);
      setSelectedUser(null);
      editForm.reset();
    } catch (err) {
      setError("Failed to update user. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (user: User) => {
    setSelectedUser(user);
    editForm.reset({
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      email: user.email,
      role: user.role,
      position: user.position || "",
      employeeNumber: user.employeeNumber || "",
    });
    setIsEditDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!selectedUser) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      // TODO: Connect to actual delete user API
      console.log("Deleting user:", selectedUser.id);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setSuccess("User deleted successfully");
      setIsDeleteDialogOpen(false);
      setSelectedUser(null);
    } catch (err) {
      setError("Failed to delete user. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeactivate = async (user: User) => {
    setIsLoading(true);
    setError(null);
    
    try {
      // TODO: Connect to actual deactivate user API
      console.log("Deactivating user:", user.id);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setSuccess(`User ${user.isActive ? 'deactivated' : 'activated'} successfully`);
    } catch (err) {
      setError("Failed to update user status. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <SidebarNavigation />
      <MobileNavigation />
      
      <main className={`flex-1 transition-all duration-300 ${isCollapsed ? 'lg:ml-16' : 'lg:ml-64'}`}>
        <div className="p-6 max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-gray-900">Account Management</h1>
            <p className="text-gray-600">Manage user accounts, roles, and permissions</p>
          </div>

          {/* Alerts */}
          {error && (
            <Alert variant="destructive" className="border-red-200 bg-red-50">
              <AlertDescription className="text-red-800">{error}</AlertDescription>
            </Alert>
          )}
          
          {success && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <AlertDescription className="text-green-800">{success}</AlertDescription>
            </Alert>
          )}

          {/* Controls */}
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="Search users..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 w-64"
                    />
                  </div>
                  <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Filter by role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Roles</SelectItem>
                      <SelectItem value="superuser">Superuser</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="supervisor">Supervisor</SelectItem>
                      <SelectItem value="user">User</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-blue-600 hover:bg-blue-700">
                      <Plus className="w-4 h-4 mr-2" />
                      Create User
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Create New User</DialogTitle>
                      <DialogDescription>
                        Add a new user to the system with appropriate role and permissions
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="firstName">First Name</Label>
                          <Input
                            id="firstName"
                            {...createForm.register("firstName")}
                            className="h-9"
                          />
                          {createForm.formState.errors.firstName && (
                            <p className="text-xs text-red-600">
                              {createForm.formState.errors.firstName.message}
                            </p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="lastName">Last Name</Label>
                          <Input
                            id="lastName"
                            {...createForm.register("lastName")}
                            className="h-9"
                          />
                          {createForm.formState.errors.lastName && (
                            <p className="text-xs text-red-600">
                              {createForm.formState.errors.lastName.message}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="username">Username</Label>
                        <Input
                          id="username"
                          {...createForm.register("username")}
                          className="h-9"
                        />
                        {createForm.formState.errors.username && (
                          <p className="text-xs text-red-600">
                            {createForm.formState.errors.username.message}
                          </p>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          {...createForm.register("email")}
                          className="h-9"
                        />
                        {createForm.formState.errors.email && (
                          <p className="text-xs text-red-600">
                            {createForm.formState.errors.email.message}
                          </p>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="password">Password</Label>
                        <Input
                          id="password"
                          type="password"
                          {...createForm.register("password")}
                          className="h-9"
                        />
                        {createForm.formState.errors.password && (
                          <p className="text-xs text-red-600">
                            {createForm.formState.errors.password.message}
                          </p>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="role">Role</Label>
                        <Select
                          value={createForm.watch("role")}
                          onValueChange={(value) => createForm.setValue("role", value as any)}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="user">User</SelectItem>
                            <SelectItem value="supervisor">Supervisor</SelectItem>
                            <SelectItem value="manager">Manager</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="superuser">Superuser</SelectItem>
                          </SelectContent>
                        </Select>
                        {createForm.formState.errors.role && (
                          <p className="text-xs text-red-600">
                            {createForm.formState.errors.role.message}
                          </p>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="position">Position</Label>
                          <Input
                            id="position"
                            {...createForm.register("position")}
                            className="h-9"
                            placeholder="Optional"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="employeeNumber">Employee #</Label>
                          <Input
                            id="employeeNumber"
                            {...createForm.register("employeeNumber")}
                            className="h-9"
                            placeholder="Optional"
                          />
                        </div>
                      </div>
                      
                      <DialogFooter>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setIsCreateDialogOpen(false)}
                        >
                          Cancel
                        </Button>
                        <Button type="submit" disabled={isLoading}>
                          {isLoading ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Creating...
                            </>
                          ) : (
                            "Create User"
                          )}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>

          {/* Users Table */}
          <Card>
            <CardHeader>
              <CardTitle>Users ({filteredUsers.length})</CardTitle>
              <CardDescription>
                Manage user accounts and their access levels
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Position</TableHead>
                      <TableHead>Employee #</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium text-gray-900">
                              {user.firstName} {user.lastName}
                            </div>
                            <div className="text-sm text-gray-500">
                              <div className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {user.username}
                              </div>
                              <div className="flex items-center gap-1">
                                <Mail className="w-3 h-3" />
                                {user.email}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getRoleBadgeVariant(user.role)} className="flex items-center gap-1 w-fit">
                            {getRoleIcon(user.role)}
                            {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-gray-600">
                          {user.position || "—"}
                        </TableCell>
                        <TableCell className="text-gray-600">
                          {user.employeeNumber ? (
                            <div className="flex items-center gap-1">
                              <Hash className="w-3 h-3" />
                              {user.employeeNumber}
                            </div>
                          ) : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={user.isActive ? "default" : "secondary"} className="flex items-center gap-1 w-fit">
                            {user.isActive ? (
                              <CheckCircle className="w-3 h-3" />
                            ) : (
                              <XCircle className="w-3 h-3" />
                            )}
                            {user.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-gray-600">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(user.createdAt).toLocaleDateString()}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(user)}
                              className="h-8 px-2"
                            >
                              <Edit className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeactivate(user)}
                              className="h-8 px-2"
                            >
                              {user.isActive ? <XCircle className="w-3 h-3" /> : <CheckCircle className="w-3 h-3" />}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedUser(user);
                                setIsDeleteDialogOpen(true);
                              }}
                              className="h-8 px-2 text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Edit User Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
              <DialogDescription>
                Update user information and role permissions
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="editFirstName">First Name</Label>
                  <Input
                    id="editFirstName"
                    {...editForm.register("firstName")}
                    className="h-9"
                  />
                  {editForm.formState.errors.firstName && (
                    <p className="text-xs text-red-600">
                      {editForm.formState.errors.firstName.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editLastName">Last Name</Label>
                  <Input
                    id="editLastName"
                    {...editForm.register("lastName")}
                    className="h-9"
                  />
                  {editForm.formState.errors.lastName && (
                    <p className="text-xs text-red-600">
                      {editForm.formState.errors.lastName.message}
                    </p>
                  )}
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="editUsername">Username</Label>
                <Input
                  id="editUsername"
                  {...editForm.register("username")}
                  className="h-9"
                />
                {editForm.formState.errors.username && (
                  <p className="text-xs text-red-600">
                    {editForm.formState.errors.username.message}
                  </p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="editEmail">Email</Label>
                <Input
                  id="editEmail"
                  type="email"
                  {...editForm.register("email")}
                  className="h-9"
                />
                {editForm.formState.errors.email && (
                  <p className="text-xs text-red-600">
                    {editForm.formState.errors.email.message}
                  </p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="editRole">Role</Label>
                <Select
                  value={editForm.watch("role")}
                  onValueChange={(value) => editForm.setValue("role", value as any)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="supervisor">Supervisor</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="superuser">Superuser</SelectItem>
                  </SelectContent>
                </Select>
                {editForm.formState.errors.role && (
                  <p className="text-xs text-red-600">
                    {editForm.formState.errors.role.message}
                  </p>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="editPosition">Position</Label>
                  <Input
                    id="editPosition"
                    {...editForm.register("position")}
                    className="h-9"
                    placeholder="Optional"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editEmployeeNumber">Employee #</Label>
                  <Input
                    id="editEmployeeNumber"
                    {...editForm.register("employeeNumber")}
                    className="h-9"
                    placeholder="Optional"
                  />
                </div>
              </div>
              
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsEditDialogOpen(false);
                    setSelectedUser(null);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Update User"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete User</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete{" "}
                <span className="font-medium">
                  {selectedUser?.firstName} {selectedUser?.lastName}
                </span>
                ? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsDeleteDialogOpen(false);
                  setSelectedUser(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete User"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}