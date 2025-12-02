import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { SidebarNavigation, MobileNavigation } from "@/components/sidebar-navigation";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { ArrowLeft, User, UserPlus, Save, Loader2 } from "lucide-react";
import { useSidebar } from "@/contexts/sidebar-context";
import { useIsMobile } from "@/hooks/use-mobile";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

// Create user form schema
const createUserSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(50, "First name must be less than 50 characters"),
  lastName: z.string().min(1, "Last name is required").max(50, "Last name must be less than 50 characters"),
  username: z.string().min(3, "Username must be at least 3 characters").max(30, "Username must be less than 30 characters"),
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string().min(8, "Please confirm your password"),
  role: z.enum(["superuser", "admin", "dispatcher", "general"]),
  position: z.string().optional(),
  employeeNumber: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type CreateUserFormData = z.infer<typeof createUserSchema>;

export default function CreateUser() {
  const { isCollapsed } = useSidebar();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const isMobile = useIsMobile();

  // Check if superuser already exists
  const { data: users } = useQuery({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const response = await fetch("/api/users", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch users");
      const data = await response.json();
      return data.users;
    },
  });

  const hasSuperuser = Array.isArray(users) && users.some((user: any) => user.role === "superuser" && user.isActive);

  const form = useForm<CreateUserFormData>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      username: "",
      email: "",
      password: "",
      confirmPassword: "",
      role: "general",
      position: "",
      employeeNumber: "",
    },
  });

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async (userData: Omit<CreateUserFormData, "confirmPassword">) => {
      const response = await apiRequest("POST", "/api/users", userData);
      return await response.json();
    },
    onSuccess: async () => {
      // Refresh the users list
      await queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/users/stats"] });
      
      toast({
        title: "User Created Successfully",
        description: "The new user has been added to the system.",
        variant: "default",
      });
      
      // Small delay to ensure cache invalidation completes before redirect
      setTimeout(() => {
        setLocation("/users");
      }, 100);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Create User",
        description: error.message || "Unable to create user. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CreateUserFormData) => {
    const { confirmPassword, ...submitData } = data;
    createUserMutation.mutate(submitData);
  };

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
                <h1 className="text-base sm:text-lg font-semibold text-gray-900 truncate">Create User</h1>
                <p className="text-xs text-gray-500 truncate">Add new account</p>
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

      {/* Main Content */}
      <main className={`flex-1 transition-all duration-300 ${
        isCollapsed ? 'ml-16' : 'ml-64'
      } ${isMobile ? 'ml-0 mt-[60px]' : ''} flex flex-col`}>
        {/* Breadcrumbs */}
        <Breadcrumbs 
          items={[
            { label: "Dashboard", href: "/" },
            { label: "Users", href: "/users" },
            { label: "Create New User", isCurrentPage: true }
          ]}
        />
        <div className="flex-1 overflow-y-auto">
          <div className="p-3 sm:p-4 md:p-6">
            <div className="w-full max-w-4xl mx-auto">

            {/* Desktop Back Button */}
            {!isMobile && (
              <Button 
                variant="ghost" 
                onClick={() => setLocation("/users")}
                className="mb-6 text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Users
              </Button>
            )}

            {/* Desktop Header */}
            {!isMobile && (
              <div className="mb-6 md:mb-8">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center">
                  <UserPlus className="w-6 h-6 sm:w-8 sm:h-8 mr-2 sm:mr-3 text-blue-600" />
                  Create New User
                </h1>
                <p className="text-sm sm:text-base text-gray-600 mt-2">
                  Add a new user to the system with appropriate permissions and details
                </p>
              </div>
            )}

            {/* Form Card */}
            <Card>
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="flex items-center text-lg sm:text-xl">
                  <User className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-blue-600" />
                  User Information
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 sm:space-y-6">
                    {/* Personal Information */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                      <FormField
                        control={form.control}
                        name="firstName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm sm:text-base">First Name *</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Enter first name" 
                                {...field} 
                                className="h-11 sm:h-10 text-sm sm:text-base"
                                inputMode="text"
                                autoCapitalize="words"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="lastName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm sm:text-base">Last Name *</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Enter last name" 
                                {...field} 
                                className="h-11 sm:h-10 text-sm sm:text-base"
                                inputMode="text"
                                autoCapitalize="words"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Account Information */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                      <FormField
                        control={form.control}
                        name="username"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm sm:text-base">Username *</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Enter username" 
                                {...field} 
                                className="h-11 sm:h-10 text-sm sm:text-base"
                                inputMode="text"
                                autoCapitalize="none"
                                autoCorrect="off"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm sm:text-base">Email Address *</FormLabel>
                            <FormControl>
                              <Input 
                                type="email" 
                                placeholder="Enter email address" 
                                {...field} 
                                className="h-11 sm:h-10 text-sm sm:text-base"
                                inputMode="email"
                                autoCapitalize="none"
                                autoComplete="email"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Password Information */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                      <FormField
                        control={form.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm sm:text-base">Password *</FormLabel>
                            <FormControl>
                              <Input 
                                type="password" 
                                placeholder="Enter password" 
                                {...field} 
                                className="h-11 sm:h-10 text-sm sm:text-base"
                                autoComplete="new-password"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="confirmPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm sm:text-base">Confirm Password *</FormLabel>
                            <FormControl>
                              <Input 
                                type="password" 
                                placeholder="Confirm password" 
                                {...field} 
                                className="h-11 sm:h-10 text-sm sm:text-base"
                                autoComplete="new-password"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Role and Work Information */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                      <FormField
                        control={form.control}
                        name="role"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm sm:text-base">Role *</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-11 sm:h-10 text-sm sm:text-base">
                                  <SelectValue placeholder="Select role" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="general">General User</SelectItem>
                                <SelectItem value="dispatcher">Dispatcher</SelectItem>
                                <SelectItem value="admin">Administrator</SelectItem>
                                <SelectItem value="superuser" disabled={hasSuperuser}>
                                  Super User {hasSuperuser ? "(Already exists)" : ""}
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="position"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm sm:text-base">Position</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Enter job position" 
                                {...field} 
                                className="h-11 sm:h-10 text-sm sm:text-base"
                                inputMode="text"
                                autoCapitalize="words"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="employeeNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm sm:text-base">Employee Number</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Enter employee number" 
                                {...field} 
                                className="h-11 sm:h-10 text-sm sm:text-base"
                                inputMode="numeric"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Submit Buttons */}
                    <div className={`flex items-center ${isMobile ? 'flex-col-reverse' : 'justify-end'} space-y-3 ${isMobile ? '' : 'space-y-0'} space-x-0 ${isMobile ? '' : 'space-x-4'} pt-4 sm:pt-6 border-t ${isMobile ? 'sticky bottom-0 bg-white pb-safe' : ''}`}>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setLocation("/users")}
                        disabled={createUserMutation.isPending}
                        className={`${isMobile ? 'w-full h-11' : 'h-10'} text-sm sm:text-base touch-manipulation`}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={createUserMutation.isPending}
                        className={`bg-blue-600 hover:bg-blue-700 ${isMobile ? 'w-full h-11' : 'h-10'} text-sm sm:text-base touch-manipulation`}
                      >
                        {createUserMutation.isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            <span className="min-w-0 truncate">Creating User...</span>
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4 mr-2 flex-shrink-0" />
                            <span className="min-w-0 truncate">Create User</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}