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
import SidebarNavigation from "@/components/sidebar-navigation";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { useAuth } from "@/hooks/use-auth";
import { useSidebar } from "@/contexts/sidebar-context";
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
    return <div>Loading...</div>;
  }

  return (
    <div className="flex">
      <SidebarNavigation />
      <div className={cn(
        "flex-1 transition-all duration-300 h-screen flex flex-col",
        isCollapsed ? "ml-16" : "ml-64"
      )}>
        {/* Breadcrumbs - Sticky at top */}
        <Breadcrumbs 
          items={[
            { label: "Dashboard", href: "/" },
            { label: "Profile", href: "/profile" },
            { label: "Edit Profile", isCurrentPage: true }
          ]}
        />
        <div className="flex-1 p-8 overflow-y-auto">
          <div className="max-w-2xl mx-auto space-y-8">

            {/* Header */}
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
                <h1 className="text-3xl font-bold text-gray-900">Edit Profile</h1>
                <p className="text-gray-600 mt-1">Update your account information</p>
              </div>
            </div>

            {/* Edit Profile Form */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <User className="w-5 h-5" />
                  <span>Personal Information</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="firstName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>First Name</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter first name" {...field} />
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
                            <FormLabel>Last Name</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter last name" {...field} />
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
                          <FormLabel>Email Address</FormLabel>
                          <FormControl>
                            <Input 
                              type="email" 
                              placeholder="Enter email address" 
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="position"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Position</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter job position" {...field} />
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
                            <FormLabel>Employee Number</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter employee number" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="flex items-center justify-between pt-6">
                      <div className="text-sm text-gray-500">
                        <p>Username and role cannot be changed.</p>
                        <p>Contact your administrator for role changes.</p>
                      </div>

                      <div className="flex space-x-3">
                        <Link href="/profile">
                          <Button type="button" variant="outline">
                            Cancel
                          </Button>
                        </Link>
                        <Button 
                          type="submit" 
                          disabled={updateProfileMutation.isPending}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          {updateProfileMutation.isPending ? (
                            <>
                              <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              Saving...
                            </>
                          ) : (
                            <>
                              <Save className="w-4 h-4 mr-2" />
                              Save Changes
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