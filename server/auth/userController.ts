import { Request, Response } from "express";
import { UserService } from "../services/userService";
import { insertUserSchema, updateUserSchema } from "@shared/schema";
import type { UserRole } from "@shared/schema";
import { ZodError } from "zod";

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: number;
    username: string;
    role: string;
  };
}

export class UserController {
  private userService: UserService;

  constructor() {
    this.userService = new UserService();
  }

  /**
   * Standardized error response helper
   */
  private sendErrorResponse(res: Response, statusCode: number, error: string, message: string, details?: any) {
    return res.status(statusCode).json({
      success: false,
      error,
      message,
      ...(details && { details }),
    });
  }

  /**
   * Standardized success response helper
   */
  private sendSuccessResponse(res: Response, statusCode: number, message: string, data?: any) {
    return res.status(statusCode).json({
      success: true,
      message,
      ...(data && data),
    });
  }

  /**
   * Validate and sanitize user input
   */
  private validateUserInput(data: any, isUpdate = false) {
    try {
      if (isUpdate) {
        return updateUserSchema.parse(data);
      } else {
        return insertUserSchema.parse(data);
      }
    } catch (error) {
      if (error instanceof ZodError) {
        const details = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
        }));
        throw { type: 'validation', details };
      }
      throw { type: 'unknown', message: 'Validation failed' };
    }
  }

  /**
   * Remove sensitive information from user object
   */
  private sanitizeUser(user: any) {
    const { passwordHash, ...safeUser } = user;
    return safeUser;
  }

  /**
   * Check if user has permission to access/modify target user
   */
  private hasUserAccess(requestingUser: AuthenticatedRequest['user'], targetUserId: number, requireAdmin = false) {
    if (!requestingUser) return false;
    
    // Superuser and admin have full access
    const isAdmin = ['superuser', 'admin'].includes(requestingUser.role);
    if (isAdmin) return true;
    
    // If admin is required and user is not admin, deny access
    if (requireAdmin) return false;
    
    // Users can access their own profile
    return requestingUser.userId === targetUserId;
  }

  /**
   * GET /api/users
   * List all users (admin only)
   */
  public listUsers = async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Check admin permission
      if (!this.hasUserAccess(req.user, 0, true)) {
        return this.sendErrorResponse(res, 403, "Insufficient permissions", 
          "Admin access required to list users");
      }

      const users = await this.userService.getAllUsers();
      const safeUsers = users.map(user => this.sanitizeUser(user));

      return this.sendSuccessResponse(res, 200, "Users retrieved successfully", {
        users: safeUsers,
        total: safeUsers.length,
      });
    } catch (error) {
      console.error("List users error:", error);
      return this.sendErrorResponse(res, 500, "Internal server error", 
        "Failed to retrieve users");
    }
  };

  /**
   * GET /api/users/:id
   * Get user by ID (admin or self)
   */
  public getUserById = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = parseInt(req.params.id);
      
      if (isNaN(userId)) {
        return this.sendErrorResponse(res, 400, "Invalid input", 
          "User ID must be a valid number");
      }

      // Check access permission
      if (!this.hasUserAccess(req.user, userId)) {
        return this.sendErrorResponse(res, 403, "Access denied", 
          "You can only view your own profile unless you're an admin");
      }

      const user = await this.userService.getUserById(userId);
      if (!user) {
        return this.sendErrorResponse(res, 404, "User not found", 
          "The requested user does not exist");
      }

      const safeUser = this.sanitizeUser(user);
      return this.sendSuccessResponse(res, 200, "User retrieved successfully", {
        user: safeUser,
      });
    } catch (error) {
      console.error("Get user error:", error);
      return this.sendErrorResponse(res, 500, "Internal server error", 
        "Failed to retrieve user");
    }
  };

  /**
   * POST /api/users
   * Create new user (admin only)
   */
  public createUser = async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Check admin permission
      if (!this.hasUserAccess(req.user, 0, true)) {
        return this.sendErrorResponse(res, 403, "Insufficient permissions", 
          "Admin access required to create users");
      }

      // Validate input
      let validatedData;
      try {
        validatedData = this.validateUserInput(req.body);
      } catch (validationError: any) {
        if (validationError.type === 'validation') {
          return this.sendErrorResponse(res, 400, "Validation failed", 
            "Invalid request data", validationError.details);
        }
        throw validationError;
      }

      // Create user
      const result = await this.userService.createUser(validatedData);
      
      if (!result.success) {
        return this.sendErrorResponse(res, 400, "User creation failed", result.message);
      }

      const safeUser = this.sanitizeUser(result.user);
      return this.sendSuccessResponse(res, 201, "User created successfully", {
        user: safeUser,
      });
    } catch (error) {
      console.error("Create user error:", error);
      return this.sendErrorResponse(res, 500, "Internal server error", 
        "Failed to create user");
    }
  };

  /**
   * PUT /api/users/:id
   * Update user (admin or self)
   */
  public updateUser = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = parseInt(req.params.id);
      
      if (isNaN(userId)) {
        return this.sendErrorResponse(res, 400, "Invalid input", 
          "User ID must be a valid number");
      }

      // Check access permission
      const isAdmin = this.hasUserAccess(req.user, 0, true);
      if (!this.hasUserAccess(req.user, userId) && !isAdmin) {
        return this.sendErrorResponse(res, 403, "Access denied", 
          "You can only edit your own profile unless you're an admin");
      }

      // Validate input
      let validatedData;
      try {
        validatedData = this.validateUserInput(req.body, true);
      } catch (validationError: any) {
        if (validationError.type === 'validation') {
          return this.sendErrorResponse(res, 400, "Validation failed", 
            "Invalid request data", validationError.details);
        }
        throw validationError;
      }

      // Non-admins cannot change role
      if (!isAdmin && validatedData.role) {
        return this.sendErrorResponse(res, 403, "Access denied", 
          "You cannot change user roles");
      }

      // Remove sensitive fields that shouldn't be updated via this endpoint
      const { password, passwordHash, ...updateData } = validatedData as any;

      const result = await this.userService.updateUser(userId, updateData);
      
      if (!result.success) {
        return this.sendErrorResponse(res, 400, "User update failed", result.message);
      }

      const safeUser = this.sanitizeUser(result.user);
      return this.sendSuccessResponse(res, 200, "User updated successfully", {
        user: safeUser,
      });
    } catch (error) {
      console.error("Update user error:", error);
      return this.sendErrorResponse(res, 500, "Internal server error", 
        "Failed to update user");
    }
  };

  /**
   * DELETE /api/users/:id
   * Delete user (admin only)
   */
  public deleteUser = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = parseInt(req.params.id);
      
      if (isNaN(userId)) {
        return this.sendErrorResponse(res, 400, "Invalid input", 
          "User ID must be a valid number");
      }

      // Check admin permission
      if (!this.hasUserAccess(req.user, 0, true)) {
        return this.sendErrorResponse(res, 403, "Insufficient permissions", 
          "Admin access required to delete users");
      }

      // Prevent self-deletion
      if (req.user?.userId === userId) {
        return this.sendErrorResponse(res, 400, "Invalid operation", 
          "You cannot delete your own account");
      }

      // Check if user exists
      const existingUser = await this.userService.getUserById(userId);
      if (!existingUser) {
        return this.sendErrorResponse(res, 404, "User not found", 
          "The requested user does not exist");
      }

      // For safety, we'll deactivate instead of hard delete
      const result = await this.userService.deactivateUser(userId);
      
      if (!result.success) {
        return this.sendErrorResponse(res, 400, "User deletion failed", result.message);
      }

      return this.sendSuccessResponse(res, 200, "User deleted successfully", {
        deletedUserId: userId,
      });
    } catch (error) {
      console.error("Delete user error:", error);
      return this.sendErrorResponse(res, 500, "Internal server error", 
        "Failed to delete user");
    }
  };

  /**
   * POST /api/users/:id/activate
   * Activate user account (admin only)
   */
  public activateUser = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = parseInt(req.params.id);
      
      if (isNaN(userId)) {
        return this.sendErrorResponse(res, 400, "Invalid input", 
          "User ID must be a valid number");
      }

      // Check admin permission
      if (!this.hasUserAccess(req.user, 0, true)) {
        return this.sendErrorResponse(res, 403, "Insufficient permissions", 
          "Admin access required to activate users");
      }

      const result = await this.userService.reactivateUser(userId);
      
      if (!result.success) {
        return this.sendErrorResponse(res, 400, "User activation failed", result.message);
      }

      const safeUser = this.sanitizeUser(result.user);
      return this.sendSuccessResponse(res, 200, "User activated successfully", {
        user: safeUser,
      });
    } catch (error) {
      console.error("Activate user error:", error);
      return this.sendErrorResponse(res, 500, "Internal server error", 
        "Failed to activate user");
    }
  };

  /**
   * POST /api/users/:id/deactivate
   * Deactivate user account (admin only)
   */
  public deactivateUser = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = parseInt(req.params.id);
      
      if (isNaN(userId)) {
        return this.sendErrorResponse(res, 400, "Invalid input", 
          "User ID must be a valid number");
      }

      // Check admin permission
      if (!this.hasUserAccess(req.user, 0, true)) {
        return this.sendErrorResponse(res, 403, "Insufficient permissions", 
          "Admin access required to deactivate users");
      }

      // Prevent self-deactivation
      if (req.user?.userId === userId) {
        return this.sendErrorResponse(res, 400, "Invalid operation", 
          "You cannot deactivate your own account");
      }

      const result = await this.userService.deactivateUser(userId);
      
      if (!result.success) {
        return this.sendErrorResponse(res, 400, "User deactivation failed", result.message);
      }

      const safeUser = this.sanitizeUser(result.user);
      return this.sendSuccessResponse(res, 200, "User deactivated successfully", {
        user: safeUser,
      });
    } catch (error) {
      console.error("Deactivate user error:", error);
      return this.sendErrorResponse(res, 500, "Internal server error", 
        "Failed to deactivate user");
    }
  };

  /**
   * GET /api/users/profile/permissions
   * Get current user's permissions
   */
  public getUserPermissions = async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return this.sendErrorResponse(res, 401, "Authentication required", 
          "You must be logged in to view permissions");
      }

      const { ROLE_PERMISSIONS } = await import("./config");
      const userPermissions = ROLE_PERMISSIONS[req.user.role as keyof typeof ROLE_PERMISSIONS] || [];

      return this.sendSuccessResponse(res, 200, "Permissions retrieved successfully", {
        permissions: userPermissions,
        role: req.user.role,
        userId: req.user.userId,
      });
    } catch (error) {
      console.error("Get permissions error:", error);
      return this.sendErrorResponse(res, 500, "Internal server error", 
        "Failed to retrieve permissions");
    }
  };
}