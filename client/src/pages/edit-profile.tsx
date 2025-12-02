import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SidebarNavigation, MobileNavigation } from "@/components/sidebar-navigation";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { useAuth } from "@/hooks/use-auth";
import { useSidebar } from "@/contexts/sidebar-context";
import { useIsMobile } from "@/hooks/use-mobile";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { ArrowLeft, Save, User, ChevronRight } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";

const editProfileSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Please enter a valid email address"),
  position: z.string().optional(),
  employeeNumber: z.string().optional(),
});

type EditProfileData = z.infer<typeof editProfileSchema>;

export default function EditProfile() {
  const { user } = useAuth();
  const { isCollapsed } = useSidebar();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  const form = useForm<EditProfileData>({
    resolver: zodResolver(editProfileSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      position: "",
      employeeNumber: "",
    },
  });

  // Pre-populate form with user data
  useEffect(() => {
    if (user) {
      form.reset({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        email: user.email || "",
        position: user.position || "",
        employeeNumber: user.employeeNumber || "",
      });
    }
  }, [user, form]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: EditProfileData) => {
      const response = await apiRequest("PUT", `/api/users/${user?.id}`, data);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Profile Updated",
        description: "Your profile has been updated successfully.",
      });
      // Invalidate user queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      // Redirect back to profile
      setLocation("/profile");
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: EditProfileData) => {
    updateProfileMutation.mutate(data);
  };

  if (!user) {
    return (
      <div className="flex h-screen overflow-hidden">
        <SidebarNavigation />
        <div className={cn(
          "flex-1 transition-all duration-300 flex flex-col",
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
                <h1 className="text-base sm:text-lg font-semibold text-gray-900 truncate">Edit Profile</h1>
                <p className="text-xs text-gray-500 truncate">Update information</p>
              </div>
            </div>
            <Button 
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/profile")}
              className="h-9 px-2 flex-shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </div>
        </header>
      )}

      <div className={cn(
        "flex-1 transition-all duration-300 flex flex-col",
        isCollapsed ? "ml-16" : "ml-64",
        isMobile ? "ml-0 mt-[60px]" : ""
      )}>
        {/* Breadcrumbs */}
        <Breadcrumbs 
          items={[
            { label: "Dashboard", href: "/" },
            { label: "Profile", href: "/profile" },
            { label: "Edit Profile", isCurrentPage: true }
          ]}
        />
        <div className="flex-1 p-3 sm:p-4 md:p-8 overflow-y-auto">
          <div className="max-w-2xl mx-auto space-y-4 sm:space-y-6 md:space-y-8">

            {/* Desktop Header */}
            {!isMobile && (
              <div className="space-y-4">
                <div className="flex items-center justify-start">
                  <Link href="/profile">
                    <Button variant="outline" size="sm" className="mb-4">
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Back to Profile
                    </Button>
                  </Link>
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Edit Profile</h1>
                  <p className="text-sm sm:text-base text-gray-600 mt-1">Update your account information</p>
                </div>
              </div>
            )}

            {/* Edit Profile Form */}
            <Card>
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="flex items-center space-x-2 text-lg sm:text-xl">
                  <User className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                  <span>Personal Information</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 sm:space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                      <FormField
                        control={form.control}
                        name="firstName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm sm:text-base">First Name</FormLabel>
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
                            <FormLabel className="text-sm sm:text-base">Last Name</FormLabel>
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

                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm sm:text-base">Email Address</FormLabel>
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

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
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

                    <div className={`flex ${isMobile ? 'flex-col-reverse' : 'items-center justify-between'} space-y-3 ${isMobile ? '' : 'space-y-0'} pt-4 sm:pt-6 ${isMobile ? 'sticky bottom-0 bg-white pb-safe' : ''}`}>
                      <div className={`text-xs sm:text-sm text-gray-500 ${isMobile ? 'order-2' : ''}`}>
                        <p>Username and role cannot be changed.</p>
                        <p>Contact your administrator for role changes.</p>
                      </div>

                      <div className={`flex ${isMobile ? 'flex-col' : ''} space-y-3 ${isMobile ? '' : 'space-y-0'} space-x-0 ${isMobile ? '' : 'space-x-3'}`}>
                        <Link href="/profile" className={isMobile ? 'w-full' : ''}>
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
                          disabled={updateProfileMutation.isPending}
                          className={`bg-blue-600 hover:bg-blue-700 ${isMobile ? 'w-full h-11' : 'h-10'} text-sm sm:text-base touch-manipulation`}
                        >
                          {updateProfileMutation.isPending ? (
                            <>
                              <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin flex-shrink-0" />
                              <span className="min-w-0 truncate">Saving...</span>
                            </>
                          ) : (
                            <>
                              <Save className="w-4 h-4 mr-2 flex-shrink-0" />
                              <span className="min-w-0 truncate">Save Changes</span>
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}