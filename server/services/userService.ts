import { eq } from "drizzle-orm";
import { db } from "../db.js";
import { users, type User, type InsertUser } from "../../shared/schema.js";
import { type UserRole } from "../auth/config.js";
import bcrypt from "bcryptjs";

export interface UserServiceResult<T = any> {
  success: boolean;
  message: string;
  user?: T;
  data?: T;
}

export class UserService {
  
  /**
   * Hash password using bcrypt
   */
  private async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return await bcrypt.hash(password, saltRounds);
  }

  /**
   * Verify password against hash
   */
  public async verifyPassword(password: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(password, hash);
  }

  /**
   * Validate user input
   */
  private validateUserData(userData: Partial<InsertUser>): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (userData.username && userData.username.length < 3) {
      errors.push("Username must be at least 3 characters long");
    }

    if (userData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userData.email)) {
      errors.push("Please provide a valid email address");
    }

    if (userData.password && userData.password.length < 8) {
      errors.push("Password must be at least 8 characters long");
    }

    if (userData.firstName && userData.firstName.length < 2) {
      errors.push("First name must be at least 2 characters long");
    }

    if (userData.lastName && userData.lastName.length < 2) {
      errors.push("Last name must be at least 2 characters long");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get all users from the database
   */
  public async getAllUsers(): Promise<User[]> {
    try {
      return await db.select().from(users);
    } catch (error) {
      console.error("Error getting all users:", error);
      throw new Error("Failed to retrieve users");
    }
  }

  /**
   * Get user by ID
   */
  public async getUserById(id: number): Promise<User | null> {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, id));
      return user || null;
    } catch (error) {
      console.error("Error getting user by ID:", error);
      throw new Error("Failed to retrieve user");
    }
  }

  /**
   * Get user by username
   */
  public async getUserByUsername(username: string): Promise<User | null> {
    try {
      const [user] = await db.select().from(users).where(eq(users.username, username));
      return user || null;
    } catch (error) {
      console.error("Error getting user by username:", error);
      throw new Error("Failed to retrieve user");
    }
  }

  /**
   * Get user by email
   */
  public async getUserByEmail(email: string): Promise<User | null> {
    try {
      const [user] = await db.select().from(users).where(eq(users.email, email));
      return user || null;
    } catch (error) {
      console.error("Error getting user by email:", error);
      throw new Error("Failed to retrieve user");
    }
  }

  /**
   * Create a new user
   */
  public async createUser(userData: InsertUser): Promise<UserServiceResult<User>> {
    try {
      // Validate input
      const validation = this.validateUserData(userData);
      if (!validation.isValid) {
        return {
          success: false,
          message: validation.errors.join(", "),
        };
      }

      // Check if username already exists
      const existingUserByUsername = await this.getUserByUsername(userData.username);
      if (existingUserByUsername) {
        return {
          success: false,
          message: "Username already exists",
        };
      }

      // Check if email already exists
      const existingUserByEmail = await this.getUserByEmail(userData.email);
      if (existingUserByEmail) {
        return {
          success: false,
          message: "Email address already exists",
        };
      }

      // Hash password
      const passwordHash = await this.hashPassword(userData.password);

      // Prepare user data for database insertion
      const newUser = {
        firstName: userData.firstName,
        lastName: userData.lastName,
        username: userData.username,
        email: userData.email,
        passwordHash,
        role: userData.role || "general",
        position: userData.position || null,
        employeeNumber: userData.employeeNumber || null,
        isActive: true,
      };

      // Insert into database
      const [createdUser] = await db.insert(users).values(newUser).returning();

      return {
        success: true,
        message: "User created successfully",
        user: createdUser,
      };
    } catch (error) {
      console.error("Error creating user:", error);
      return {
        success: false,
        message: "Failed to create user",
      };
    }
  }

  /**
   * Generate JWT token for user
   */
  public async generateTokenForUser(user: User): Promise<string> {
    const jwt = await import("jsonwebtoken");
    const { jwtConfig } = await import("../auth/config.js");
    
    const payload = {
      userId: user.id,
      username: user.username,
      role: user.role,
    };
    
    return jwt.default.sign(payload, jwtConfig.secret, {
      expiresIn: jwtConfig.expiresIn,
      issuer: jwtConfig.issuer,
      audience: jwtConfig.audience,
    } as any);
  }

  /**
   * Change user password
   */
  public async changePassword(userId: number, currentPassword: string, newPassword: string): Promise<UserServiceResult> {
    try {
      const user = await this.getUserById(userId);
      if (!user) {
        return {
          success: false,
          message: "User not found",
        };
      }

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isCurrentPasswordValid) {
        return {
          success: false,
          message: "Current password is incorrect",
        };
      }

      // Hash new password
      const hashedNewPassword = await this.hashPassword(newPassword);

      // Update password
      await db.update(users)
        .set({ 
          passwordHash: hashedNewPassword,
          updatedAt: new Date()
        })
        .where(eq(users.id, userId));

      return {
        success: true,
        message: "Password changed successfully",
      };
    } catch (error) {
      console.error("Error changing password:", error);
      return {
        success: false,
        message: "Failed to change password",
      };
    }
  }

  /**
   * Update user information
   */
  public async updateUser(id: number, updateData: Partial<InsertUser>): Promise<UserServiceResult<User>> {
    try {
      // Check if user exists
      const existingUser = await this.getUserById(id);
      if (!existingUser) {
        return {
          success: false,
          message: "User not found",
        };
      }

      // Validate input (skip validation for partial updates)
      if (Object.keys(updateData).length > 0) {
        const validation = this.validateUserData(updateData);
        if (!validation.isValid) {
          return {
            success: false,
            message: validation.errors.join(", "),
          };
        }
      }

      // Check for username conflicts (excluding current user)
      if (updateData.username && updateData.username !== existingUser.username) {
        const userWithUsername = await this.getUserByUsername(updateData.username);
        if (userWithUsername && userWithUsername.id !== id) {
          return {
            success: false,
            message: "Username already exists",
          };
        }
      }

      // Check for email conflicts (excluding current user)
      if (updateData.email && updateData.email !== existingUser.email) {
        const userWithEmail = await this.getUserByEmail(updateData.email);
        if (userWithEmail && userWithEmail.id !== id) {
          return {
            success: false,
            message: "Email address already exists",
          };
        }
      }

      // Remove sensitive fields that shouldn't be updated directly
      const { passwordHash, password, id: _, createdAt, ...safeUpdateData } = updateData as any;

      // Update the user
      const [updatedUser] = await db
        .update(users)
        .set({
          ...safeUpdateData,
          updatedAt: new Date(),
        })
        .where(eq(users.id, id))
        .returning();

      return {
        success: true,
        message: "User updated successfully",
        user: updatedUser,
      };
    } catch (error) {
      console.error("Error updating user:", error);
      return {
        success: false,
        message: "Failed to update user",
      };
    }
  }

  /**
   * Update user password
   */
  public async updatePassword(id: number, currentPassword: string, newPassword: string): Promise<UserServiceResult> {
    try {
      // Get user
      const user = await this.getUserById(id);
      if (!user) {
        return {
          success: false,
          message: "User not found",
        };
      }

      // Verify current password
      const isCurrentPasswordValid = await this.verifyPassword(currentPassword, user.passwordHash);
      if (!isCurrentPasswordValid) {
        return {
          success: false,
          message: "Current password is incorrect",
        };
      }

      // Validate new password
      if (newPassword.length < 8) {
        return {
          success: false,
          message: "New password must be at least 8 characters long",
        };
      }

      // Hash new password
      const newPasswordHash = await this.hashPassword(newPassword);

      // Update password
      await db
        .update(users)
        .set({
          passwordHash: newPasswordHash,
          updatedAt: new Date(),
        })
        .where(eq(users.id, id));

      return {
        success: true,
        message: "Password updated successfully",
      };
    } catch (error) {
      console.error("Error updating password:", error);
      return {
        success: false,
        message: "Failed to update password",
      };
    }
  }

  /**
   * Deactivate user account
   */
  public async deactivateUser(id: number): Promise<UserServiceResult<User>> {
    try {
      const existingUser = await this.getUserById(id);
      if (!existingUser) {
        return {
          success: false,
          message: "User not found",
        };
      }

      if (!existingUser.isActive) {
        return {
          success: false,
          message: "User is already deactivated",
        };
      }

      const [updatedUser] = await db
        .update(users)
        .set({
          isActive: false,
          updatedAt: new Date(),
        })
        .where(eq(users.id, id))
        .returning();

      return {
        success: true,
        message: "User deactivated successfully",
        user: updatedUser,
      };
    } catch (error) {
      console.error("Error deactivating user:", error);
      return {
        success: false,
        message: "Failed to deactivate user",
      };
    }
  }

  /**
   * Permanently delete user from database
   */
  public async deleteUserPermanently(id: number): Promise<UserServiceResult> {
    try {
      const existingUser = await this.getUserById(id);
      if (!existingUser) {
        return {
          success: false,
          message: "User not found",
        };
      }

      // Permanently delete user from database
      const result = await db.delete(users).where(eq(users.id, id)).returning();

      if (result.length === 0) {
        return {
          success: false,
          message: "User not found or could not be deleted",
        };
      }

      return {
        success: true,
        message: "User permanently deleted from database",
      };
    } catch (error) {
      console.error("Error permanently deleting user:", error);
      return {
        success: false,
        message: "Failed to permanently delete user",
      };
    }
  }

  /**
   * Reactivate user account
   */
  public async reactivateUser(id: number): Promise<UserServiceResult<User>> {
    try {
      const existingUser = await this.getUserById(id);
      if (!existingUser) {
        return {
          success: false,
          message: "User not found",
        };
      }

      if (existingUser.isActive) {
        return {
          success: false,
          message: "User is already active",
        };
      }

      const [updatedUser] = await db
        .update(users)
        .set({
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(users.id, id))
        .returning();

      return {
        success: true,
        message: "User reactivated successfully",
        user: updatedUser,
      };
    } catch (error) {
      console.error("Error reactivating user:", error);
      return {
        success: false,
        message: "Failed to reactivate user",
      };
    }
  }

  /**
   * Get user count by role
   */
  public async getUserCountByRole(): Promise<Record<string, number>> {
    try {
      const allUsers = await this.getAllUsers();
      const counts: Record<string, number> = {};

      allUsers.forEach(user => {
        counts[user.role] = (counts[user.role] || 0) + 1;
      });

      return counts;
    } catch (error) {
      console.error("Error getting user count by role:", error);
      throw new Error("Failed to get user statistics");
    }
  }

  /**
   * Get active users count
   */
  public async getActiveUsersCount(): Promise<number> {
    try {
      const allUsers = await this.getAllUsers();
      return allUsers.filter(user => user.isActive).length;
    } catch (error) {
      console.error("Error getting active users count:", error);
      throw new Error("Failed to get active users count");
    }
  }

  /**
   * Authenticate user login
   */
  public async login(username: string, password: string): Promise<UserServiceResult<User & { token?: string }>> {
    try {
      // Get user by username
      const user = await this.getUserByUsername(username);
      if (!user) {
        return {
          success: false,
          message: "Invalid username or password",
        };
      }

      // Check if user is active
      if (!user.isActive) {
        return {
          success: false,
          message: "Account has been deactivated",
        };
      }

      // Verify password
      const isPasswordValid = await this.verifyPassword(password, user.passwordHash);
      if (!isPasswordValid) {
        return {
          success: false,
          message: "Invalid username or password",
        };
      }

      // Generate JWT token
      const { generateToken } = await import("../auth/jwt.js");
      const token = generateToken(user);

      return {
        success: true,
        message: "Login successful",
        user: { ...user, token },
      };
    } catch (error) {
      console.error("Login error:", error);
      return {
        success: false,
        message: "Login failed",
      };
    }
  }

  /**
   * Create default superuser if none exists
   */
  public async createDefaultSuperuser(): Promise<void> {
    try {
      // Check if any superuser exists
      const allUsers = await this.getAllUsers();
      const existingSuperuser = allUsers.find(user => user.role === "superuser");
      
      if (existingSuperuser) {
        console.log("Superuser already exists");
        return;
      }

      console.log("Creating default superuser account...");
      
      // Create default superuser
      const result = await this.createUser({
        firstName: "System",
        lastName: "Administrator", 
        username: "admin",
        email: "admin@company.com",
        password: "Admin123!",
        role: "superuser",
        position: "System Administrator",
        employeeNumber: "ADMIN001",
      });

      if (result.success) {
        console.log("Default superuser created successfully");
      } else {
        console.error("Failed to create default superuser:", result.message);
      }
    } catch (error) {
      console.error("Error creating default superuser:", error);
    }
  }
}