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
import { Separator } from "@/components/ui/separator";
import { SidebarNavigation, MobileNavigation } from "@/components/sidebar-navigation";
import { useSidebar } from "@/contexts/sidebar-context";
import { 
  Loader2, 
  Edit, 
  Shield, 
  User, 
  Mail, 
  Building, 
  Hash, 
  Calendar, 
  CheckCircle, 
  Key,
  Save,
  X
} from "lucide-react";

const updateProfileSchema = z.object({
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  lastName: z.string().min(2, "Last name must be at least 2 characters"),
  username: z.string().min(3, "Username must be at least 3 characters"),
  email: z.string().email("Invalid email address"),
  position: z.string().optional(),
  employeeNumber: z.string().optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
  confirmPassword: z.string().min(1, "Password confirmation is required"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type UpdateProfileForm = z.infer<typeof updateProfileSchema>;
type ChangePasswordForm = z.infer<typeof changePasswordSchema>;

interface CurrentUser {
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

export default function UserProfile() {
  const { isCollapsed } = useSidebar();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Mock current user data - TODO: Replace with actual API call
  const currentUser: CurrentUser = {
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
  };

  const profileForm = useForm<UpdateProfileForm>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      firstName: currentUser.firstName,
      lastName: currentUser.lastName,
      username: currentUser.username,
      email: currentUser.email,
      position: currentUser.position || "",
      employeeNumber: currentUser.employeeNumber || "",
    },
  });

  const passwordForm = useForm<ChangePasswordForm>({
    resolver: zodResolver(changePasswordSchema),
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
        return <Shield className="w-4 h-4" />;
      case "manager":
        return <Building className="w-4 h-4" />;
      default:
        return <User className="w-4 h-4" />;
    }
  };

  const onProfileSubmit = async (data: UpdateProfileForm) => {
    setIsLoading(true);
    setError(null);
    
    try {
      // TODO: Connect to actual update profile API
      console.log("Updating profile:", data);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setSuccess("Profile updated successfully");
      setIsEditDialogOpen(false);
    } catch (err) {
      setError("Failed to update profile. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const onPasswordSubmit = async (data: ChangePasswordForm) => {
    setIsLoading(true);
    setError(null);
    
    try {
      // TODO: Connect to actual change password API
      console.log("Changing password for user:", currentUser.id);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setSuccess("Password changed successfully");
      setIsPasswordDialogOpen(false);
      passwordForm.reset();
    } catch (err) {
      setError("Failed to change password. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <SidebarNavigation />
      <MobileNavigation />
      
      <main className={`flex-1 transition-all duration-300 ${isCollapsed ? 'lg:ml-16' : 'lg:ml-64'}`}>
        <div className="p-6 max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-gray-900">My Profile</h1>
            <p className="text-gray-600">Manage your account information and preferences</p>
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

          {/* Profile Information Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <User className="w-5 h-5" />
                    Profile Information
                  </CardTitle>
                  <CardDescription>
                    Your personal details and account information
                  </CardDescription>
                </div>
                <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Edit className="w-4 h-4 mr-2" />
                      Edit Profile
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Edit Profile</DialogTitle>
                      <DialogDescription>
                        Update your personal information. Your role and permissions cannot be changed here.
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="firstName">First Name</Label>
                          <Input
                            id="firstName"
                            {...profileForm.register("firstName")}
                            className="h-9"
                          />
                          {profileForm.formState.errors.firstName && (
                            <p className="text-xs text-red-600">
                              {profileForm.formState.errors.firstName.message}
                            </p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="lastName">Last Name</Label>
                          <Input
                            id="lastName"
                            {...profileForm.register("lastName")}
                            className="h-9"
                          />
                          {profileForm.formState.errors.lastName && (
                            <p className="text-xs text-red-600">
                              {profileForm.formState.errors.lastName.message}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="username">Username</Label>
                        <Input
                          id="username"
                          {...profileForm.register("username")}
                          className="h-9"
                        />
                        {profileForm.formState.errors.username && (
                          <p className="text-xs text-red-600">
                            {profileForm.formState.errors.username.message}
                          </p>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          {...profileForm.register("email")}
                          className="h-9"
                        />
                        {profileForm.formState.errors.email && (
                          <p className="text-xs text-red-600">
                            {profileForm.formState.errors.email.message}
                          </p>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="position">Position</Label>
                          <Input
                            id="position"
                            {...profileForm.register("position")}
                            className="h-9"
                            placeholder="Optional"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="employeeNumber">Employee #</Label>
                          <Input
                            id="employeeNumber"
                            {...profileForm.register("employeeNumber")}
                            className="h-9"
                            placeholder="Optional"
                          />
                        </div>
                      </div>
                      
                      <DialogFooter>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setIsEditDialogOpen(false)}
                        >
                          <X className="w-4 h-4 mr-2" />
                          Cancel
                        </Button>
                        <Button type="submit" disabled={isLoading}>
                          {isLoading ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            <>
                              <Save className="w-4 h-4 mr-2" />
                              Save Changes
                            </>
                          )}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Full Name</Label>
                    <div className="mt-1 text-lg font-semibold text-gray-900">
                      {currentUser.firstName} {currentUser.lastName}
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Username</Label>
                    <div className="mt-1 flex items-center gap-2 text-gray-900">
                      <User className="w-4 h-4 text-gray-500" />
                      {currentUser.username}
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Email Address</Label>
                    <div className="mt-1 flex items-center gap-2 text-gray-900">
                      <Mail className="w-4 h-4 text-gray-500" />
                      {currentUser.email}
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Role</Label>
                    <div className="mt-1">
                      <Badge variant={getRoleBadgeVariant(currentUser.role)} className="flex items-center gap-2 w-fit">
                        {getRoleIcon(currentUser.role)}
                        {currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1)}
                      </Badge>
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Position</Label>
                    <div className="mt-1 flex items-center gap-2 text-gray-900">
                      <Building className="w-4 h-4 text-gray-500" />
                      {currentUser.position || "Not specified"}
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Employee Number</Label>
                    <div className="mt-1 flex items-center gap-2 text-gray-900">
                      <Hash className="w-4 h-4 text-gray-500" />
                      {currentUser.employeeNumber || "Not specified"}
                    </div>
                  </div>
                </div>
              </div>
              
              <Separator />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label className="text-sm font-medium text-gray-700">Account Status</Label>
                  <div className="mt-1">
                    <Badge variant={currentUser.isActive ? "default" : "secondary"} className="flex items-center gap-2 w-fit">
                      <CheckCircle className="w-4 h-4" />
                      {currentUser.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </div>
                
                <div>
                  <Label className="text-sm font-medium text-gray-700">Member Since</Label>
                  <div className="mt-1 flex items-center gap-2 text-gray-900">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    {new Date(currentUser.createdAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Security Settings Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    Security Settings
                  </CardTitle>
                  <CardDescription>
                    Manage your password and security preferences
                  </CardDescription>
                </div>
                <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Key className="w-4 h-4 mr-2" />
                      Change Password
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Change Password</DialogTitle>
                      <DialogDescription>
                        Enter your current password and choose a new secure password
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="currentPassword">Current Password</Label>
                        <Input
                          id="currentPassword"
                          type="password"
                          {...passwordForm.register("currentPassword")}
                          className="h-9"
                        />
                        {passwordForm.formState.errors.currentPassword && (
                          <p className="text-xs text-red-600">
                            {passwordForm.formState.errors.currentPassword.message}
                          </p>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="newPassword">New Password</Label>
                        <Input
                          id="newPassword"
                          type="password"
                          {...passwordForm.register("newPassword")}
                          className="h-9"
                        />
                        {passwordForm.formState.errors.newPassword && (
                          <p className="text-xs text-red-600">
                            {passwordForm.formState.errors.newPassword.message}
                          </p>
                        )}
                        <p className="text-xs text-gray-500">
                          Must be at least 8 characters long
                        </p>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="confirmPassword">Confirm New Password</Label>
                        <Input
                          id="confirmPassword"
                          type="password"
                          {...passwordForm.register("confirmPassword")}
                          className="h-9"
                        />
                        {passwordForm.formState.errors.confirmPassword && (
                          <p className="text-xs text-red-600">
                            {passwordForm.formState.errors.confirmPassword.message}
                          </p>
                        )}
                      </div>
                      
                      <DialogFooter>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setIsPasswordDialogOpen(false);
                            passwordForm.reset();
                          }}
                        >
                          <X className="w-4 h-4 mr-2" />
                          Cancel
                        </Button>
                        <Button type="submit" disabled={isLoading}>
                          {isLoading ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Updating...
                            </>
                          ) : (
                            <>
                              <Key className="w-4 h-4 mr-2" />
                              Change Password
                            </>
                          )}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-gray-700">Password</Label>
                  <div className="mt-1 text-gray-500">
                    Last updated {new Date(currentUser.updatedAt).toLocaleDateString()}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    Click "Change Password" to update your password. Use a strong password with at least 8 characters.
                  </p>
                </div>
                
                <Separator />
                
                <div>
                  <Label className="text-sm font-medium text-gray-700">Security Tips</Label>
                  <ul className="mt-2 text-sm text-gray-600 space-y-1">
                    <li>• Use a unique password that you don't use elsewhere</li>
                    <li>• Include uppercase, lowercase, numbers, and special characters</li>
                    <li>• Don't share your login credentials with others</li>
                    <li>• Log out when you're finished using the system</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Account Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Account Activity
              </CardTitle>
              <CardDescription>
                Information about your account activity and access
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label className="text-sm font-medium text-gray-700">Account Created</Label>
                  <div className="mt-1 text-gray-900">
                    {new Date(currentUser.createdAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>
                
                <div>
                  <Label className="text-sm font-medium text-gray-700">Last Updated</Label>
                  <div className="mt-1 text-gray-900">
                    {new Date(currentUser.updatedAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}