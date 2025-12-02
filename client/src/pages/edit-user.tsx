import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Save, User } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { SidebarNavigation, MobileNavigation } from "@/components/sidebar-navigation";
import { useSidebar } from "@/contexts/sidebar-context";
import { useIsMobile } from "@/hooks/use-mobile";
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
  const isMobile = useIsMobile();
  
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
          isCollapsed ? "ml-16" : "ml-64",
          isMobile ? "ml-0 mt-[60px]" : ""
        )}>
          <div className="p-4 sm:p-6 md:p-8">
            <div className="max-w-2xl mx-auto">
              <div className="text-sm sm:text-base">Loading...</div>
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
          isCollapsed ? "ml-16" : "ml-64",
          isMobile ? "ml-0 mt-[60px]" : ""
        )}>
          <div className="p-4 sm:p-6 md:p-8">
            <div className="max-w-2xl mx-auto">
              <div className="text-sm sm:text-base">User not found</div>
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
          isCollapsed ? "ml-16" : "ml-64",
          isMobile ? "ml-0 mt-[60px]" : ""
        )}>
          <div className="p-4 sm:p-6 md:p-8">
            <div className="max-w-2xl mx-auto">
              <div className="text-sm sm:text-base">You don't have permission to edit this user.</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
                <h1 className="text-base sm:text-lg font-semibold text-gray-900 truncate">Edit User</h1>
                <p className="text-xs text-gray-500 truncate">Update information</p>
              </div>
            </div>
            <Button 
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/users")}
              className="h-9 px-2 flex-shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
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
              items={[
                { label: "Users", href: "/users" },
                { label: "Edit User", href: `/users/${userId}/edit` }
              ]} 
            />
            
            {/* Desktop Header */}
            {!isMobile && (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Edit User</h1>
                    <p className="text-sm sm:text-base text-gray-600 mt-1">Update user information and permissions</p>
                  </div>
                  <Link href="/users">
                    <Button variant="outline">
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Back to Users
                    </Button>
                  </Link>
                </div>
                <Separator />
              </>
            )}

            {/* Edit User Form */}
            <Card>
              <CardHeader className="p-4 sm:p-6">
                <div className="flex items-center space-x-2">
                  <User className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 flex-shrink-0" />
                  <div>
                    <CardTitle className="text-lg sm:text-xl">User Information</CardTitle>
                    <CardDescription className="text-xs sm:text-sm">
                      Update the user's profile information and role permissions
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 sm:space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="firstName" className="text-sm sm:text-base">First Name</Label>
                      <Input
                        id="firstName"
                        {...form.register("firstName")}
                        placeholder="Enter first name"
                        className="h-11 sm:h-10 text-sm sm:text-base"
                        inputMode="text"
                        autoCapitalize="words"
                      />
                      {form.formState.errors.firstName && (
                        <p className="text-xs sm:text-sm text-red-600">
                          {form.formState.errors.firstName.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="lastName" className="text-sm sm:text-base">Last Name</Label>
                      <Input
                        id="lastName"
                        {...form.register("lastName")}
                        placeholder="Enter last name"
                        className="h-11 sm:h-10 text-sm sm:text-base"
                        inputMode="text"
                        autoCapitalize="words"
                      />
                      {form.formState.errors.lastName && (
                        <p className="text-xs sm:text-sm text-red-600">
                          {form.formState.errors.lastName.message}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="username" className="text-sm sm:text-base">Username</Label>
                      <Input
                        id="username"
                        {...form.register("username")}
                        placeholder="Enter username"
                        className="h-11 sm:h-10 text-sm sm:text-base"
                        inputMode="text"
                        autoCapitalize="none"
                        autoCorrect="off"
                      />
                      {form.formState.errors.username && (
                        <p className="text-xs sm:text-sm text-red-600">
                          {form.formState.errors.username.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-sm sm:text-base">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        {...form.register("email")}
                        placeholder="Enter email address"
                        className="h-11 sm:h-10 text-sm sm:text-base"
                        inputMode="email"
                        autoCapitalize="none"
                        autoComplete="email"
                      />
                      {form.formState.errors.email && (
                        <p className="text-xs sm:text-sm text-red-600">
                          {form.formState.errors.email.message}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="role" className="text-sm sm:text-base">Role</Label>
                      <Select 
                        value={form.watch("role")} 
                        onValueChange={(value) => form.setValue("role", value as any)}
                      >
                        <SelectTrigger className="h-11 sm:h-10 text-sm sm:text-base">
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
                        <p className="text-xs sm:text-sm text-red-600">
                          {form.formState.errors.role.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="position" className="text-sm sm:text-base">Position</Label>
                      <Input
                        id="position"
                        {...form.register("position")}
                        placeholder="Enter position (optional)"
                        className="h-11 sm:h-10 text-sm sm:text-base"
                        inputMode="text"
                        autoCapitalize="words"
                      />
                      {form.formState.errors.position && (
                        <p className="text-xs sm:text-sm text-red-600">
                          {form.formState.errors.position.message}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="employeeNumber" className="text-sm sm:text-base">Employee Number</Label>
                    <Input
                      id="employeeNumber"
                      {...form.register("employeeNumber")}
                      placeholder="Enter employee number (optional)"
                      className="h-11 sm:h-10 text-sm sm:text-base"
                      inputMode="numeric"
                    />
                    {form.formState.errors.employeeNumber && (
                      <p className="text-xs sm:text-sm text-red-600">
                        {form.formState.errors.employeeNumber.message}
                      </p>
                    )}
                  </div>

                  <Separator />

                  <div className={`flex ${isMobile ? 'flex-col-reverse' : 'justify-end'} space-y-3 ${isMobile ? '' : 'space-y-0'} space-x-0 ${isMobile ? '' : 'space-x-4'} ${isMobile ? 'sticky bottom-0 bg-white pb-safe pt-4' : ''}`}>
                    <Link href="/users">
                      <Button 
                        type="button" 
                        variant="outline"
                        className={`${isMobile ? 'w-full h-11' : 'h-10'} text-sm sm:text-base touch-manipulation`}
                      >
                        Cancel
                      </Button>
                    </Link>
                    <Button 
                      type="submit" 
                      disabled={updateUserMutation.isPending}
                      className={`${isMobile ? 'w-full h-11' : 'h-10'} text-sm sm:text-base touch-manipulation`}
                    >
                      {updateUserMutation.isPending ? (
                        <>
                          <Save className="w-4 h-4 mr-2 animate-spin flex-shrink-0" />
                          <span className="min-w-0 truncate">Updating...</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2 flex-shrink-0" />
                          <span className="min-w-0 truncate">Update User</span>
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