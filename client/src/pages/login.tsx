import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Ship, Lock, User } from "lucide-react";

const loginSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(1, "Password is required"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    setError(null);

    try {
      // TODO: Connect to actual login API
      console.log("Login attempt:", data);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // TODO: Handle successful login and redirect
      console.log("Login successful");
    } catch (err) {
      setError("Invalid username or password. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-8 items-center">
        {/* Left Side - Login Form */}
        <div className="flex justify-center lg:justify-end">
          <Card className="w-full max-w-md shadow-xl border-0 bg-white/95 backdrop-blur-sm">
            <CardHeader className="space-y-2 text-center">
              <div className="mx-auto w-12 h-12 bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl flex items-center justify-center mb-4">
                <Ship className="w-6 h-6 text-white" />
              </div>
              <CardTitle className="text-2xl font-bold text-gray-900">
                Welcome Back
              </CardTitle>
              <CardDescription className="text-gray-600">
                Sign in to access the Maritime Dispatch System
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {error && (
                <Alert variant="destructive" className="border-red-200 bg-red-50">
                  <AlertDescription className="text-red-800">
                    {error}
                  </AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username" className="text-sm font-medium text-gray-700">
                    Username or Email
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      id="username"
                      type="text"
                      placeholder="Enter your username"
                      className="pl-10 h-11 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                      {...register("username")}
                    />
                  </div>
                  {errors.username && (
                    <p className="text-sm text-red-600">{errors.username.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                    Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="Enter your password"
                      className="pl-10 h-11 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                      {...register("password")}
                    />
                  </div>
                  {errors.password && (
                    <p className="text-sm text-red-600">{errors.password.message}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full h-11 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-medium rounded-lg transition-all duration-200"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    "Sign In"
                  )}
                </Button>
              </form>

              <div className="text-center text-sm text-gray-500">
                Having trouble? Contact your system administrator
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Side - Brand/Hero Section */}
        <div className="hidden lg:block space-y-8">
          <div className="space-y-6">
            <h1 className="text-4xl font-bold text-gray-900 leading-tight">
              Maritime Dispatch
              <span className="block text-3xl text-blue-600 font-semibold mt-2">
                Management System
              </span>
            </h1>
            <p className="text-lg text-gray-600 max-w-lg">
              Streamline your maritime operations with our comprehensive dispatch 
              and reporting platform. Manage multiple ships, generate reports, 
              and track operations efficiently.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 max-w-lg">
            <div className="bg-white/70 backdrop-blur-sm rounded-lg p-4 border border-gray-100">
              <div className="text-2xl font-bold text-blue-600 mb-1">3</div>
              <div className="text-sm text-gray-600">Ships Managed</div>
            </div>
            <div className="bg-white/70 backdrop-blur-sm rounded-lg p-4 border border-gray-100">
              <div className="text-2xl font-bold text-blue-600 mb-1">24/7</div>
              <div className="text-sm text-gray-600">Operations</div>
            </div>
            <div className="bg-white/70 backdrop-blur-sm rounded-lg p-4 border border-gray-100">
              <div className="text-2xl font-bold text-blue-600 mb-1">Real-time</div>
              <div className="text-sm text-gray-600">Reporting</div>
            </div>
            <div className="bg-white/70 backdrop-blur-sm rounded-lg p-4 border border-gray-100">
              <div className="text-2xl font-bold text-blue-600 mb-1">Secure</div>
              <div className="text-sm text-gray-600">Access Control</div>
            </div>
          </div>

          <div className="text-sm text-gray-500">
            Trusted by maritime professionals worldwide
          </div>
        </div>
      </div>
    </div>
  );
}