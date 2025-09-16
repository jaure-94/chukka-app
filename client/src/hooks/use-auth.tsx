import { createContext, ReactNode, useContext } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { getQueryFn, apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type User = {
  id: number;
  username: string;
  firstName: string;
  lastName: string;
  role: string;
  email: string;
  position?: string;
  employeeNumber?: string;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
};

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<User, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
};

type LoginData = {
  username: string;
  password: string;
};

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  
  const {
    data: user,
    error,
    isLoading,
  } = useQuery<User | null, Error>({
    queryKey: ["/api/auth/user"],
    queryFn: async () => {
      try {
        const response = await fetch("/api/auth/user", {
          credentials: 'include',
        });
        if (response.status === 401) {
          return null; // Not authenticated
        }
        if (!response.ok) {
          throw new Error('Failed to fetch user');
        }
        const data = await response.json();
        // Backend returns {success: true, user: {...}}, we need just the user
        return data.user || data;
      } catch (error) {
        return null; // Return null for auth errors
      }
    },
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      const res = await apiRequest("POST", "/api/auth/login", credentials);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Login failed');
      }
      const data = await res.json();
      return data.user;
    },
    onSuccess: (user: User) => {
      queryClient.setQueryData(["/api/auth/user"], user);
      toast({
        title: "Welcome back!",
        description: `Successfully logged in as ${user.firstName} ${user.lastName}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/auth/logout");
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Logout failed');
      }
      return;
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/auth/user"], null);
      queryClient.clear(); // Clear all queries
      // Clear any stored tokens
      localStorage.removeItem('token');
      sessionStorage.removeItem('token');
      toast({
        title: "Logged out",
        description: "You have been successfully logged out",
      });
    },
    onError: (error: Error) => {
      // Even if logout fails on server, clear client-side data
      queryClient.setQueryData(["/api/auth/user"], null);
      queryClient.clear();
      localStorage.removeItem('token');
      sessionStorage.removeItem('token');
      toast({
        title: "Logged out",
        description: "Session ended",
        variant: "default",
      });
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        error,
        loginMutation,
        logoutMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}