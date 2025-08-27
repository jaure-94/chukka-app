import { z } from "zod";

// JWT Configuration
export const jwtConfig = {
  secret: process.env.JWT_SECRET || "your-super-secret-jwt-key-change-in-production",
  expiresIn: "7d", // Token expiration time
  refreshExpiresIn: "30d", // Refresh token expiration time
  issuer: "maritime-dispatch-system",
  audience: "maritime-dispatch-users",
};

// Cookie Configuration
export const cookieConfig = {
  name: "auth_token",
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
  path: "/",
};

// Password validation
export const passwordValidation = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: false,
};

// User roles and permissions
export const USER_ROLES = {
  SUPERUSER: "superuser",
  ADMIN: "admin", 
  DISPATCHER: "dispatcher",
  GENERAL: "general",
} as const;

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];

// Role hierarchy (higher number = more permissions)
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  [USER_ROLES.GENERAL]: 1,
  [USER_ROLES.DISPATCHER]: 2,
  [USER_ROLES.ADMIN]: 3,
  [USER_ROLES.SUPERUSER]: 4,
};

// Permissions mapping
export const PERMISSIONS = {
  // User management
  CREATE_USERS: "create_users",
  EDIT_USERS: "edit_users", 
  DELETE_USERS: "delete_users",
  VIEW_USERS: "view_users",
  
  // Report permissions
  VIEW_DISPATCH_REPORTS: "view_dispatch_reports",
  EDIT_DISPATCH_REPORTS: "edit_dispatch_reports",
  GENERATE_DISPATCH_REPORTS: "generate_dispatch_reports",
  
  VIEW_EOD_REPORTS: "view_eod_reports",
  EDIT_EOD_REPORTS: "edit_eod_reports", 
  GENERATE_EOD_REPORTS: "generate_eod_reports",
  
  VIEW_PAX_REPORTS: "view_pax_reports",
  EDIT_PAX_REPORTS: "edit_pax_reports",
  GENERATE_PAX_REPORTS: "generate_pax_reports",
  
  // Template permissions
  UPLOAD_TEMPLATES: "upload_templates",
  EDIT_TEMPLATES: "edit_templates",
  DELETE_TEMPLATES: "delete_templates",
  
  // System permissions
  SYSTEM_ADMIN: "system_admin",
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

// Role-based permissions
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [USER_ROLES.GENERAL]: [
    // General users can only view basic reports
    PERMISSIONS.VIEW_DISPATCH_REPORTS,
    PERMISSIONS.VIEW_EOD_REPORTS,
  ],
  
  [USER_ROLES.DISPATCHER]: [
    // Dispatchers can view, edit and generate dispatch and EOD reports
    PERMISSIONS.VIEW_DISPATCH_REPORTS,
    PERMISSIONS.EDIT_DISPATCH_REPORTS,
    PERMISSIONS.GENERATE_DISPATCH_REPORTS,
    PERMISSIONS.VIEW_EOD_REPORTS,
    PERMISSIONS.EDIT_EOD_REPORTS,
    PERMISSIONS.GENERATE_EOD_REPORTS,
    PERMISSIONS.VIEW_PAX_REPORTS,
    PERMISSIONS.EDIT_PAX_REPORTS,
    PERMISSIONS.GENERATE_PAX_REPORTS,
    PERMISSIONS.UPLOAD_TEMPLATES,
    PERMISSIONS.EDIT_TEMPLATES,
  ],
  
  [USER_ROLES.ADMIN]: [
    // Admins have all dispatcher permissions plus user management
    PERMISSIONS.VIEW_DISPATCH_REPORTS,
    PERMISSIONS.EDIT_DISPATCH_REPORTS,
    PERMISSIONS.GENERATE_DISPATCH_REPORTS,
    PERMISSIONS.VIEW_EOD_REPORTS,
    PERMISSIONS.EDIT_EOD_REPORTS,
    PERMISSIONS.GENERATE_EOD_REPORTS,
    PERMISSIONS.VIEW_PAX_REPORTS,
    PERMISSIONS.EDIT_PAX_REPORTS,
    PERMISSIONS.GENERATE_PAX_REPORTS,
    PERMISSIONS.UPLOAD_TEMPLATES,
    PERMISSIONS.EDIT_TEMPLATES,
    PERMISSIONS.CREATE_USERS,
    PERMISSIONS.EDIT_USERS,
    PERMISSIONS.DELETE_USERS,
    PERMISSIONS.VIEW_USERS,
    PERMISSIONS.DELETE_TEMPLATES,
  ],
  
  [USER_ROLES.SUPERUSER]: [
    // All permissions (complete system access)
    ...Object.values(PERMISSIONS),
  ],
};

// Helper functions
export function hasPermission(userRole: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[userRole]?.includes(permission) || false;
}

export function hasMinimumRole(userRole: UserRole, minimumRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[minimumRole];
}

export function getRolePermissions(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] || [];
}