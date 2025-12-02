import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Ship, Lock, User } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

const loginSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(1, "Password is required"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [, setLocation] = useLocation();
  const { user, loginMutation } = useAuth();

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      setLocation("/");
    }
  }, [user, setLocation]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    setError(null);
    
    try {
      await loginMutation.mutateAsync(data);
      setLocation("/"); // Redirect to home on successful login
    } catch (err) {
      setError("Invalid username or password. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-6 sm:gap-8 items-center">
        {/* Left Side - Login Form */}
        <div className="flex justify-center lg:justify-end w-full">
          <Card className="w-full max-w-md shadow-xl border-0 bg-white/95 backdrop-blur-sm">
            <CardHeader className="space-y-2 text-center px-4 sm:px-6 pt-6 sm:pt-8 pb-4 sm:pb-6">
              <div className="mx-auto w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl flex items-center justify-center mb-3 sm:mb-4">
                <Ship className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
              </div>
              <CardTitle className="text-xl sm:text-2xl font-bold text-gray-900 leading-tight">
                Welcome Back
              </CardTitle>
              <CardDescription className="text-sm sm:text-base text-gray-600 mt-1 sm:mt-2">
                Sign in to access the Maritime Dispatch System
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 sm:space-y-6 px-4 sm:px-6 pb-6 sm:pb-8">
              {error && (
                <Alert variant="destructive" className="border-red-200 bg-red-50 text-sm sm:text-base">
                  <AlertDescription className="text-red-800 text-sm sm:text-base">
                    {error}
                  </AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 sm:space-y-5">
                <div className="space-y-2">
                  <Label 
                    htmlFor="username" 
                    className="text-sm sm:text-base font-medium text-gray-700 block"
                  >
                    Username or Email
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400 pointer-events-none" />
                    <Input
                      id="username"
                      type="text"
                      inputMode="email"
                      autoComplete="username"
                      autoCapitalize="none"
                      autoCorrect="off"
                      placeholder="Enter your username"
                      className="pl-10 sm:pl-11 h-11 sm:h-12 text-base sm:text-sm border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 transition-all"
                      {...register("username")}
                    />
                  </div>
                  {errors.username && (
                    <p className="text-sm text-red-600 mt-1 px-1">{errors.username.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label 
                    htmlFor="password" 
                    className="text-sm sm:text-base font-medium text-gray-700 block"
                  >
                    Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400 pointer-events-none" />
                    <Input
                      id="password"
                      type="password"
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      className="pl-10 sm:pl-11 h-11 sm:h-12 text-base sm:text-sm border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 transition-all"
                      {...register("password")}
                    />
                  </div>
                  {errors.password && (
                    <p className="text-sm text-red-600 mt-1 px-1">{errors.password.message}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full h-11 sm:h-12 text-base sm:text-sm font-medium bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg transition-all duration-200 shadow-sm hover:shadow-md active:scale-[0.98] touch-manipulation"
                  disabled={loginMutation.isPending}
                >
                  {loginMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 mr-2 animate-spin" />
                      <span>Signing in...</span>
                    </>
                  ) : (
                    "Sign In"
                  )}
                </Button>
              </form>

              <div className="text-center text-xs sm:text-sm text-gray-500 pt-2">
                Having trouble? Contact your system administrator
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Side - Brand/Hero Section */}
        <div className="hidden lg:block space-y-6 xl:space-y-8">
          <div className="space-y-4 xl:space-y-6">
            <h1 className="text-3xl xl:text-4xl font-bold text-gray-900 leading-tight">
              Maritime Dispatch
              <span className="block text-2xl xl:text-3xl text-blue-600 font-semibold mt-2">
                Management System
              </span>
            </h1>
            <p className="text-base xl:text-lg text-gray-600 max-w-lg leading-relaxed">
              Streamline your maritime operations with our comprehensive dispatch 
              and reporting platform. Manage multiple ships, generate reports, 
              and track operations efficiently.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 xl:gap-4 max-w-lg">
            <div className="bg-white/70 backdrop-blur-sm rounded-lg p-3 xl:p-4 border border-gray-100">
              <div className="text-xl xl:text-2xl font-bold text-blue-600 mb-1">3</div>
              <div className="text-xs xl:text-sm text-gray-600">Ships Managed</div>
            </div>
            <div className="bg-white/70 backdrop-blur-sm rounded-lg p-3 xl:p-4 border border-gray-100">
              <div className="text-xl xl:text-2xl font-bold text-blue-600 mb-1">24/7</div>
              <div className="text-xs xl:text-sm text-gray-600">Operations</div>
            </div>
            <div className="bg-white/70 backdrop-blur-sm rounded-lg p-3 xl:p-4 border border-gray-100">
              <div className="text-xl xl:text-2xl font-bold text-blue-600 mb-1">Real-time</div>
              <div className="text-xs xl:text-sm text-gray-600">Reporting</div>
            </div>
            <div className="bg-white/70 backdrop-blur-sm rounded-lg p-3 xl:p-4 border border-gray-100">
              <div className="text-xl xl:text-2xl font-bold text-blue-600 mb-1">Secure</div>
              <div className="text-xs xl:text-sm text-gray-600">Access Control</div>
            </div>
          </div>

          <div className="text-xs xl:text-sm text-gray-500">
            Trusted by maritime professionals worldwide
          </div>
        </div>
      </div>
    </div>
  );
}