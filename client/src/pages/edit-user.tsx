import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Save, User } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import SidebarNavigation from "@/components/sidebar-navigation";
import { useSidebar } from "@/contexts/sidebar-context";
import { cn } from "@/lib/utils";
import { Link, useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getQueryFn, apiRequest } from "@/lib/queryClient";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";

const editUserSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  username: z.string().min(3, "Username must be at least 3 characters"),
  email: z.string().email("Please enter a valid email address"),
  role: z.enum(['superuser', 'admin', 'dispatcher', 'general']),
  position: z.string().optional(),
  employeeNumber: z.string().optional(),
});

type EditUserForm = z.infer<typeof editUserSchema>;

export default function EditUser() {
  const { user: currentUser } = useAuth();
  const { isCollapsed } = useSidebar();
  const params = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const userId = params.id;
  
  // Fetch user data to edit
  const { data: userResponse, isLoading } = useQuery({
    queryKey: [`/api/users/${userId}`],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!userId,
  });
  
  const user = (userResponse as any)?.user;

  const form = useForm<EditUserForm>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      username: "",
      email: "",
      role: "general",
      position: "",
      employeeNumber: "",
    }
  });

  // Pre-populate form when user data is loaded
  useEffect(() => {
    if (user) {
      form.reset({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        username: user.username || "",
        email: user.email || "",
        role: user.role || "general",
        position: user.position || "",
        employeeNumber: user.employeeNumber || "",
      });
    }
  }, [user, form]);

  const updateUserMutation = useMutation({
    mutationFn: async (data: EditUserForm) => {
      const response = await apiRequest("PUT", `/api/users/${userId}`, data);
      return await response.json();
    },
    onSuccess: () => {
      // Refresh the user data and users list
      queryClient.invalidateQueries({ queryKey: [`/api/users/${userId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users/stats"] });
      
      toast({
        title: "User Updated",
        description: "User information has been successfully updated.",
      });
      
      // Navigate back to users page
      setLocation("/users");
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update user. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: EditUserForm) => {
    updateUserMutation.mutate(data);
  };

  if (!userId || isLoading) {
    return (
      <div className="flex h-screen overflow-hidden">
        <SidebarNavigation />
        <div className={cn(
          "flex-1 transition-all duration-300 overflow-y-auto",
          isCollapsed ? "ml-16" : "ml-64"
        )}>
          <div className="p-8">
            <div className="max-w-2xl mx-auto">
              <div>Loading...</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-screen overflow-hidden">
        <SidebarNavigation />
        <div className={cn(
          "flex-1 transition-all duration-300 overflow-y-auto",
          isCollapsed ? "ml-16" : "ml-64"
        )}>
          <div className="p-8">
            <div className="max-w-2xl mx-auto">
              <div>User not found</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Check if current user has permission to edit this user
  const canEdit = currentUser?.role === 'superuser' || 
                  currentUser?.role === 'admin' || 
                  currentUser?.id === parseInt(userId);

  if (!canEdit) {
    return (
      <div className="flex h-screen overflow-hidden">
        <SidebarNavigation />
        <div className={cn(
          "flex-1 transition-all duration-300 overflow-y-auto",
          isCollapsed ? "ml-16" : "ml-64"
        )}>
          <div className="p-8">
            <div className="max-w-2xl mx-auto">
              <div>You don't have permission to edit this user.</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <SidebarNavigation />
      <div className={cn(
        "flex-1 transition-all duration-300 overflow-y-auto",
        isCollapsed ? "ml-16" : "ml-64"
      )}>
        <div className="p-8">
          <div className="max-w-2xl mx-auto space-y-8">
            {/* Breadcrumbs */}
            <Breadcrumbs 
              items={[
                { label: "Users", href: "/users" },
                { label: "Edit User", href: `/users/${userId}/edit` }
              ]} 
            />
            
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Edit User</h1>
                <p className="text-gray-600 mt-1">Update user information and permissions</p>
              </div>
              <Link href="/users">
                <Button variant="outline">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Users
                </Button>
              </Link>
            </div>

            <Separator />

            {/* Edit User Form */}
            <Card>
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <User className="w-5 h-5 text-blue-600" />
                  <div>
                    <CardTitle>User Information</CardTitle>
                    <CardDescription>
                      Update the user's profile information and role permissions
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name</Label>
                      <Input
                        id="firstName"
                        {...form.register("firstName")}
                        placeholder="Enter first name"
                      />
                      {form.formState.errors.firstName && (
                        <p className="text-sm text-red-600">
                          {form.formState.errors.firstName.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input
                        id="lastName"
                        {...form.register("lastName")}
                        placeholder="Enter last name"
                      />
                      {form.formState.errors.lastName && (
                        <p className="text-sm text-red-600">
                          {form.formState.errors.lastName.message}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="username">Username</Label>
                      <Input
                        id="username"
                        {...form.register("username")}
                        placeholder="Enter username"
                      />
                      {form.formState.errors.username && (
                        <p className="text-sm text-red-600">
                          {form.formState.errors.username.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        {...form.register("email")}
                        placeholder="Enter email address"
                      />
                      {form.formState.errors.email && (
                        <p className="text-sm text-red-600">
                          {form.formState.errors.email.message}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="role">Role</Label>
                      <Select 
                        value={form.watch("role")} 
                        onValueChange={(value) => form.setValue("role", value as any)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="general">General User</SelectItem>
                          <SelectItem value="dispatcher">Dispatcher</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                          {currentUser?.role === 'superuser' && (
                            <SelectItem value="superuser">Superuser</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      {form.formState.errors.role && (
                        <p className="text-sm text-red-600">
                          {form.formState.errors.role.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="position">Position</Label>
                      <Input
                        id="position"
                        {...form.register("position")}
                        placeholder="Enter position (optional)"
                      />
                      {form.formState.errors.position && (
                        <p className="text-sm text-red-600">
                          {form.formState.errors.position.message}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="employeeNumber">Employee Number</Label>
                    <Input
                      id="employeeNumber"
                      {...form.register("employeeNumber")}
                      placeholder="Enter employee number (optional)"
                    />
                    {form.formState.errors.employeeNumber && (
                      <p className="text-sm text-red-600">
                        {form.formState.errors.employeeNumber.message}
                      </p>
                    )}
                  </div>

                  <Separator />

                  <div className="flex justify-end space-x-4">
                    <Link href="/users">
                      <Button type="button" variant="outline">
                        Cancel
                      </Button>
                    </Link>
                    <Button 
                      type="submit" 
                      disabled={updateUserMutation.isPending}
                    >
                      {updateUserMutation.isPending ? (
                        <>
                          <Save className="w-4 h-4 mr-2 animate-spin" />
                          Updating...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          Update User
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}