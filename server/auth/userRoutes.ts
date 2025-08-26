import { Router } from "express";
import { UserController, type AuthenticatedRequest } from "./userController";
import { authenticateToken, rateLimit } from "./middleware";
import { requireAdmin } from "./roleMiddleware";

const router = Router();
const userController = new UserController();

/**
 * GET /api/users
 * Get all users (admin only)
 */
router.get(
  "/",
  authenticateToken,
  requireAdmin,
  userController.listUsers
);

/**
 * GET /api/users/:id
 * Get user by ID (admin or self)
 */
router.get(
  "/:id",
  authenticateToken,
  userController.getUserById
);

/**
 * POST /api/users
 * Create new user (admin only)
 */
router.post(
  "/",
  authenticateToken,
  requireAdmin,
  rateLimit(10, 15 * 60 * 1000), // 10 user creations per 15 minutes
  userController.createUser
);

/**
 * PUT /api/users/:id
 * Update user (admin or self)
 */
router.put(
  "/:id",
  authenticateToken,
  rateLimit(20, 15 * 60 * 1000), // 20 updates per 15 minutes
  userController.updateUser
);

/**
 * DELETE /api/users/:id
 * Delete user (admin only)
 */
router.delete(
  "/:id",
  authenticateToken,
  requireAdmin,
  userController.deleteUser
);

/**
 * POST /api/users/:id/activate
 * Activate user account (admin only)
 */
router.post(
  "/:id/activate",
  authenticateToken,
  requireAdmin,
  userController.activateUser
);

/**
 * POST /api/users/:id/deactivate
 * Deactivate user account (admin only)
 */
router.post(
  "/:id/deactivate",
  authenticateToken,
  requireAdmin,
  userController.deactivateUser
);

/**
 * GET /api/users/profile/permissions
 * Get current user's permissions
 */
router.get(
  "/profile/permissions",
  authenticateToken,
  userController.getUserPermissions
);

export default router;