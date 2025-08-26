import { Router } from "express";
import { UserService } from "../services/userService";
import { 
  requireAuth, 
  requireAdmin, 
  requireUserManagement,
  requireAuthAndRole,
  hasRole,
  hasPermissions
} from "./roleMiddleware";
import { authenticateToken, validateRequest, rateLimit } from "./middleware";
import { insertUserSchema, updateUserSchema } from "@shared/schema";
import type { AuthenticatedRequest } from "./roleMiddleware";

const router = Router();
const userService = new UserService();

/**
 * GET /api/users
 * Get all users (admin only)
 */
router.get(
  "/",
  authenticateToken,
  requireAdmin,
  async (req: AuthenticatedRequest, res) => {
    try {
      const users = await userService.getAllUsers();
      
      // Remove password hashes from response
      const safeUsers = users.map(user => {
        const { passwordHash, ...safeUser } = user;
        return safeUser;
      });
      
      res.json({
        success: true,
        users: safeUsers,
      });
    } catch (error) {
      console.error("Get users error:", error);
      res.status(500).json({
        error: "Internal server error",
        message: "Failed to retrieve users",
      });
    }
  }
);

/**
 * GET /api/users/:id
 * Get user by ID
 */
router.get(
  "/:id",
  authenticateToken,
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      const userId = parseInt(req.params.id);
      const requestingUser = req.user!;
      
      // Users can only view their own profile unless they're admin+
      if (requestingUser.userId !== userId && !hasRole(requestingUser, "superuser", "admin")) {
        return res.status(403).json({
          error: "Access denied",
          message: "You can only view your own profile",
        });
      }
      
      const user = await userService.getUserById(userId);
      if (!user) {
        return res.status(404).json({
          error: "User not found",
          message: "The requested user does not exist",
        });
      }
      
      // Remove password hash from response
      const { passwordHash, ...safeUser } = user;
      
      res.json({
        success: true,
        user: safeUser,
      });
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({
        error: "Internal server error",
        message: "Failed to retrieve user",
      });
    }
  }
);

/**
 * POST /api/users
 * Create new user (admin only)
 */
router.post(
  "/",
  authenticateToken,
  requireUserManagement,
  rateLimit(10, 15 * 60 * 1000), // 10 user creations per 15 minutes
  async (req: AuthenticatedRequest, res) => {
    try {
      const result = await userService.createUser(req.body);
      
      if (!result.success) {
        return res.status(400).json({
          error: "User creation failed",
          message: result.message,
        });
      }
      
      // Remove password hash from response
      const { passwordHash, ...safeUser } = result.user!;
      
      res.status(201).json({
        success: true,
        message: "User created successfully",
        user: safeUser,
      });
    } catch (error) {
      console.error("Create user error:", error);
      res.status(500).json({
        error: "Internal server error",
        message: "Failed to create user",
      });
    }
  }
);

/**
 * PATCH /api/users/:id
 * Update user (admin or own profile)
 */
router.patch(
  "/:id",
  authenticateToken,
  requireAuth,
  rateLimit(20, 15 * 60 * 1000), // 20 updates per 15 minutes
  async (req: AuthenticatedRequest, res) => {
    try {
      const userId = parseInt(req.params.id);
      const requestingUser = req.user!;
      
      // Users can only edit their own profile unless they're admin+
      const canEditOthers = hasRole(requestingUser, "superuser", "admin");
      if (requestingUser.userId !== userId && !canEditOthers) {
        return res.status(403).json({
          error: "Access denied",
          message: "You can only edit your own profile",
        });
      }
      
      // Non-admins cannot change role
      if (!canEditOthers && req.body.role) {
        return res.status(403).json({
          error: "Access denied",
          message: "You cannot change user roles",
        });
      }
      
      // Remove sensitive fields that shouldn't be updated via this endpoint
      const { password, passwordHash, ...updateData } = req.body;
      
      const result = await userService.updateUser(userId, updateData);
      
      if (!result.success) {
        return res.status(400).json({
          error: "User update failed",
          message: result.message,
        });
      }
      
      // Remove password hash from response
      const { passwordHash: _, ...safeUser } = result.user!;
      
      res.json({
        success: true,
        message: "User updated successfully",
        user: safeUser,
      });
    } catch (error) {
      console.error("Update user error:", error);
      res.status(500).json({
        error: "Internal server error",
        message: "Failed to update user",
      });
    }
  }
);

/**
 * POST /api/users/:id/deactivate
 * Deactivate user account (admin only)
 */
router.post(
  "/:id/deactivate",
  authenticateToken,
  requireAdmin,
  async (req: AuthenticatedRequest, res) => {
    try {
      const userId = parseInt(req.params.id);
      
      // Prevent self-deactivation
      if (req.user!.userId === userId) {
        return res.status(400).json({
          error: "Invalid operation",
          message: "You cannot deactivate your own account",
        });
      }
      
      const result = await userService.deactivateUser(userId);
      
      if (!result.success) {
        return res.status(400).json({
          error: "Deactivation failed",
          message: result.message,
        });
      }
      
      res.json({
        success: true,
        message: "User deactivated successfully",
      });
    } catch (error) {
      console.error("Deactivate user error:", error);
      res.status(500).json({
        error: "Internal server error",
        message: "Failed to deactivate user",
      });
    }
  }
);

/**
 * POST /api/users/:id/reactivate
 * Reactivate user account (admin only)
 */
router.post(
  "/:id/reactivate",
  authenticateToken,
  requireAdmin,
  async (req: AuthenticatedRequest, res) => {
    try {
      const userId = parseInt(req.params.id);
      
      const result = await userService.reactivateUser(userId);
      
      if (!result.success) {
        return res.status(400).json({
          error: "Reactivation failed",
          message: result.message,
        });
      }
      
      res.json({
        success: true,
        message: "User reactivated successfully",
      });
    } catch (error) {
      console.error("Reactivate user error:", error);
      res.status(500).json({
        error: "Internal server error",
        message: "Failed to reactivate user",
      });
    }
  }
);

/**
 * GET /api/users/profile/permissions
 * Get current user's permissions
 */
router.get(
  "/profile/permissions",
  authenticateToken,
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      const { ROLE_PERMISSIONS } = await import("./config");
      const userPermissions = ROLE_PERMISSIONS[user.role as keyof typeof ROLE_PERMISSIONS] || [];
      
      res.json({
        success: true,
        permissions: userPermissions,
        role: user.role,
      });
    } catch (error) {
      console.error("Get permissions error:", error);
      res.status(500).json({
        error: "Internal server error",
        message: "Failed to retrieve permissions",
      });
    }
  }
);

export default router;