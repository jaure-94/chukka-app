import { Request, Response, NextFunction } from "express";
import { USER_ROLES, ROLE_PERMISSIONS, PERMISSIONS, type UserRole } from "./config.js";
import type { Permission } from "./config.js";

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: number;
    username: string;
    role: UserRole;
  };
}

/**
 * Middleware to ensure user is authenticated
 * Should be used before any role-based middleware
 */
export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({
      error: "Authentication required",
      message: "You must be logged in to access this resource",
    });
  }
  next();
}

/**
 * Middleware to check if user has one of the specified roles
 * Usage: requireRole("admin"), requireRole("manager", "admin")
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: "Authentication required",
        message: "You must be logged in to access this resource",
      });
    }

    const userRole = req.user.role;
    
    // Superuser always has access
    if (userRole === USER_ROLES.SUPERUSER) {
      return next();
    }

    // Check if user's role is in the allowed roles
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        error: "Insufficient permissions",
        message: `Access denied. Required role(s): ${allowedRoles.join(", ")}. Your role: ${userRole}`,
      });
    }

    next();
  };
}

/**
 * Middleware to check if user has specific permissions
 * Usage: requirePermissions(PERMISSIONS.CREATE_USERS, PERMISSIONS.EDIT_USERS)
 */
export function requirePermissions(...requiredPermissions: Permission[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: "Authentication required",
        message: "You must be logged in to access this resource",
      });
    }

    const userRole = req.user.role;
    const userPermissions = ROLE_PERMISSIONS[userRole as keyof typeof ROLE_PERMISSIONS] || [];

    // Check if user has all required permissions
    const hasAllPermissions = requiredPermissions.every(permission => 
      userPermissions.includes(permission)
    );

    if (!hasAllPermissions) {
      const missingPermissions = requiredPermissions.filter(permission => 
        !userPermissions.includes(permission)
      );
      
      return res.status(403).json({
        error: "Insufficient permissions",
        message: `Access denied. Missing permissions: ${missingPermissions.join(", ")}`,
      });
    }

    next();
  };
}

/**
 * Middleware for admin-only routes
 * Allows superuser and admin roles
 */
export const requireAdmin = requireRole(USER_ROLES.SUPERUSER, USER_ROLES.ADMIN);

/**
 * Middleware for dispatcher-level routes
 * Allows superuser, admin, and dispatcher roles
 */
export const requireDispatcher = requireRole(USER_ROLES.SUPERUSER, USER_ROLES.ADMIN, USER_ROLES.DISPATCHER);

/**
 * Middleware for general-level routes
 * Allows all roles
 */
export const requireGeneral = requireRole(
  USER_ROLES.SUPERUSER, 
  USER_ROLES.ADMIN, 
  USER_ROLES.DISPATCHER, 
  USER_ROLES.GENERAL
);

/**
 * Middleware for dispatch-related operations
 * Requires permission to view/edit dispatch reports
 */
export const requireDispatchAccess = requirePermissions(
  PERMISSIONS.VIEW_DISPATCH_REPORTS
);

/**
 * Middleware for dispatch editing operations
 * Requires permission to edit dispatch reports
 */
export const requireDispatchEdit = requirePermissions(
  PERMISSIONS.EDIT_DISPATCH_REPORTS
);

/**
 * Middleware for EOD-related operations
 * Requires permission to view/edit EOD reports
 */
export const requireEODAccess = requirePermissions(
  PERMISSIONS.VIEW_EOD_REPORTS
);

/**
 * Middleware for EOD editing operations
 * Requires permission to edit EOD reports
 */
export const requireEODEdit = requirePermissions(
  PERMISSIONS.EDIT_EOD_REPORTS
);

/**
 * Middleware for PAX-related operations
 * Requires permission to view/edit PAX reports
 */
export const requirePAXAccess = requirePermissions(
  PERMISSIONS.VIEW_PAX_REPORTS
);

/**
 * Middleware for PAX editing operations
 * Requires permission to edit PAX reports
 */
export const requirePAXEdit = requirePermissions(
  PERMISSIONS.EDIT_PAX_REPORTS
);

/**
 * Middleware for template management operations
 * Requires permission to upload templates
 */
export const requireTemplateAccess = requirePermissions(
  PERMISSIONS.UPLOAD_TEMPLATES
);

/**
 * Middleware for template editing operations
 * Requires permission to edit templates
 */
export const requireTemplateEdit = requirePermissions(
  PERMISSIONS.EDIT_TEMPLATES
);

/**
 * Middleware for user management operations
 * Requires permission to create/edit users
 */
export const requireUserManagement = requirePermissions(
  PERMISSIONS.CREATE_USERS
);

/**
 * Middleware that combines authentication check with role verification
 * Usage: requireAuthAndRole("admin"), requireAuthAndRole("manager", "admin")
 */
export function requireAuthAndRole(...allowedRoles: UserRole[]) {
  return [requireAuth, requireRole(...allowedRoles)];
}

/**
 * Middleware that combines authentication check with permission verification
 * Usage: requireAuthAndPermissions(PERMISSIONS.CREATE_USERS)
 */
export function requireAuthAndPermissions(...requiredPermissions: Permission[]) {
  return [requireAuth, requirePermissions(...requiredPermissions)];
}

/**
 * Helper function to check if user has specific role (for use in route handlers)
 */
export function hasRole(user: AuthenticatedRequest['user'], ...roles: UserRole[]): boolean {
  if (!user) return false;
  if (user.role === USER_ROLES.SUPERUSER) return true;
  return roles.includes(user.role);
}

/**
 * Helper function to check if user has specific permissions (for use in route handlers)
 */
export function hasPermissions(user: AuthenticatedRequest['user'], ...permissions: Permission[]): boolean {
  if (!user) return false;
  
  const userPermissions = ROLE_PERMISSIONS[user.role as keyof typeof ROLE_PERMISSIONS] || [];
  return permissions.every(permission => userPermissions.includes(permission));
}