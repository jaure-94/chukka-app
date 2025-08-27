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
    queryFn: getQueryFn(),
  });
}

export function useUserStats() {
  return useQuery<UserStats>({
    queryKey: ["/api/users/stats"],
    queryFn: getQueryFn(),
  });
}