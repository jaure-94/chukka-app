import { Router } from "express";
import { authenticateToken, validateRequest, rateLimit } from "./middleware.js";
import { cookieConfig } from "./config.js";
import { UserService } from "../services/userService.js";
import { loginSchema } from "@shared/schema";

const router = Router();
const userService = new UserService();

/**
 * POST /api/auth/login
 * Authenticate user and return JWT token
 */
router.post(
  "/login",
  rateLimit(5, 15 * 60 * 1000), // 5 attempts per 15 minutes
  validateRequest(loginSchema),
  async (req, res) => {
    try {
      const { username, password } = req.body;
      
      const result = await userService.login(username, password);
      
      if (!result.success) {
        return res.status(401).json({
          error: "Authentication failed",
          message: result.message,
        });
      }
      
      // Set HTTP-only cookie with the token
      const token = (result.user as any).token;
      res.cookie(cookieConfig.name, token, cookieConfig);
      
      // Also return token in response body for flexibility
      res.json({
        success: true,
        message: "Login successful",
        user: {
          id: result.user!.id,
          username: result.user!.username,
          firstName: result.user!.firstName,
          lastName: result.user!.lastName,
          role: result.user!.role,
          email: result.user!.email,
          position: result.user!.position,
          employeeNumber: result.user!.employeeNumber,
        },
        token: token,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({
        error: "Internal server error",
        message: "An error occurred during login",
      });
    }
  }
);

/**
 * POST /api/auth/logout
 * Logout user and clear JWT token
 */
router.post("/logout", authenticateToken, async (req, res) => {
  try {
    // Clear the HTTP-only cookie
    res.clearCookie(cookieConfig.name, {
      httpOnly: cookieConfig.httpOnly,
      secure: cookieConfig.secure,
      sameSite: cookieConfig.sameSite,
      path: cookieConfig.path,
    });
    
    res.json({
      success: true,
      message: "Logout successful",
    });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "An error occurred during logout",
    });
  }
});

/**
 * GET /api/auth/user
 * Get current authenticated user info
 */
router.get("/user", authenticateToken, async (req, res) => {
  try {
    // The JWT payload contains username, not userId, so we need to look up by username
    const username = req.user!.username;
    const user = await userService.getUserByUsername(username);
    
    if (!user) {
      return res.status(404).json({
        error: "User not found",
        message: "User account no longer exists",
      });
    }
    
    if (!user.isActive) {
      return res.status(403).json({
        error: "Account disabled",
        message: "Your account has been disabled",
      });
    }
    
    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        email: user.email,
        position: user.position,
        employeeNumber: user.employeeNumber,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error("Get user info error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "An error occurred while fetching user information",
    });
  }
});

/**
 * POST /api/auth/refresh
 * Refresh JWT token
 */
router.post("/refresh", authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const user = await userService.getUserById(userId);
    
    if (!user || !user.isActive) {
      return res.status(401).json({
        error: "Invalid user",
        message: "User account is not valid or has been disabled",
      });
    }
    
    const newToken = await userService.generateTokenForUser(user);
    
    // Set new HTTP-only cookie
    res.cookie(cookieConfig.name, newToken, cookieConfig);
    
    res.json({
      success: true,
      message: "Token refreshed successfully",
      token: newToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
  } catch (error) {
    console.error("Token refresh error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "An error occurred while refreshing token",
    });
  }
});

/**
 * POST /api/auth/change-password
 * Change user password
 */
router.post(
  "/change-password",
  authenticateToken,
  rateLimit(3, 15 * 60 * 1000), // 3 attempts per 15 minutes
  async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      
      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          error: "Missing fields",
          message: "Current password and new password are required",
        });
      }
      
      const userId = req.user!.userId;
      const result = await userService.changePassword(userId, currentPassword, newPassword);
      
      if (!result.success) {
        return res.status(400).json({
          error: "Password change failed",
          message: result.message,
        });
      }
      
      res.json({
        success: true,
        message: "Password changed successfully",
      });
    } catch (error) {
      console.error("Change password error:", error);
      res.status(500).json({
        error: "Internal server error",
        message: "An error occurred while changing password",
      });
    }
  }
);

export default router;