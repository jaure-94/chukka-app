import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";

export type SystemUser = {
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

export type UserStats = {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  pendingUsers: number;
};

export function useUsers() {
  return useQuery<SystemUser[]>({
    queryKey: ["/api/users"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    select: (data: any) => {
      if (!data) return [];
      return data.users || [];
    },
  });
}

export function useUserStats() {
  return useQuery<UserStats>({
    queryKey: ["/api/users/stats"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    select: (data: any) => {
      if (!data) return { totalUsers: 0, activeUsers: 0, inactiveUsers: 0, pendingUsers: 0 };
      // The API returns the stats directly in the response, not nested
      return {
        totalUsers: data.totalUsers || 0,
        activeUsers: data.activeUsers || 0,
        inactiveUsers: data.inactiveUsers || 0,
        pendingUsers: data.pendingUsers || 0,
      };
    },
  });
}