import { eq, and } from "drizzle-orm";
import { db } from "../db";
import { users } from "@shared/schema";
import type { User, InsertUser } from "@shared/schema";
import { hashPassword, verifyPassword, validatePasswordStrength } from "../auth/password";
import { generateToken } from "../auth/jwt";

export interface LoginResult {
  success: boolean;
  message: string;
  user?: User;
  token?: string;
}

export interface PasswordChangeResult {
  success: boolean;
  message: string;
}

export interface CreateUserResult {
  success: boolean;
  message: string;
  user?: User;
}

export class UserService {
  /**
   * Authenticate user with username and password
   */
  async login(username: string, password: string): Promise<LoginResult> {
    try {
      // Find user by username
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.username, username))
        .limit(1);

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
          message: "Account has been disabled",
        };
      }

      // Verify password
      const isPasswordValid = await verifyPassword(password, user.passwordHash);
      if (!isPasswordValid) {
        return {
          success: false,
          message: "Invalid username or password",
        };
      }

      // Generate JWT token
      const token = generateToken(user);

      return {
        success: true,
        message: "Login successful",
        user,
        token,
      };
    } catch (error) {
      console.error("Login error:", error);
      return {
        success: false,
        message: "An error occurred during login",
      };
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(id: number): Promise<User | null> {
    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, id))
        .limit(1);

      return user || null;
    } catch (error) {
      console.error("Get user by ID error:", error);
      return null;
    }
  }

  /**
   * Get user by username
   */
  async getUserByUsername(username: string): Promise<User | null> {
    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.username, username))
        .limit(1);

      return user || null;
    } catch (error) {
      console.error("Get user by username error:", error);
      return null;
    }
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<User | null> {
    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      return user || null;
    } catch (error) {
      console.error("Get user by email error:", error);
      return null;
    }
  }

  /**
   * Create a new user
   */
  async createUser(userData: InsertUser): Promise<CreateUserResult> {
    try {
      // Validate password strength
      const passwordValidation = validatePasswordStrength(userData.password);
      if (!passwordValidation.isValid) {
        return {
          success: false,
          message: passwordValidation.errors.join(", "),
        };
      }

      // Check if username already exists
      const existingUser = await this.getUserByUsername(userData.username);
      if (existingUser) {
        return {
          success: false,
          message: "Username already exists",
        };
      }

      // Check if email already exists
      const existingEmail = await this.getUserByEmail(userData.email);
      if (existingEmail) {
        return {
          success: false,
          message: "Email address already exists",
        };
      }

      // Hash password
      const passwordHash = await hashPassword(userData.password);

      // Create user (omit password from userData)
      const { password: _, ...userDataWithoutPassword } = userData;
      const [newUser] = await db
        .insert(users)
        .values({
          ...userDataWithoutPassword,
          passwordHash,
          role: userData.role || "user",
          isActive: true,
        })
        .returning();

      return {
        success: true,
        message: "User created successfully",
        user: newUser,
      };
    } catch (error) {
      console.error("Create user error:", error);
      return {
        success: false,
        message: "An error occurred while creating the user",
      };
    }
  }

  /**
   * Update user information
   */
  async updateUser(id: number, updateData: Partial<Omit<InsertUser, 'password'>>): Promise<CreateUserResult> {
    try {
      // Check if user exists
      const existingUser = await this.getUserById(id);
      if (!existingUser) {
        return {
          success: false,
          message: "User not found",
        };
      }

      // Check for username conflicts (if username is being updated)
      if (updateData.username && updateData.username !== existingUser.username) {
        const usernameExists = await this.getUserByUsername(updateData.username);
        if (usernameExists) {
          return {
            success: false,
            message: "Username already exists",
          };
        }
      }

      // Check for email conflicts (if email is being updated)
      if (updateData.email && updateData.email !== existingUser.email) {
        const emailExists = await this.getUserByEmail(updateData.email);
        if (emailExists) {
          return {
            success: false,
            message: "Email address already exists",
          };
        }
      }

      // Update user
      const [updatedUser] = await db
        .update(users)
        .set({
          ...updateData,
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
      console.error("Update user error:", error);
      return {
        success: false,
        message: "An error occurred while updating the user",
      };
    }
  }

  /**
   * Change user password
   */
  async changePassword(userId: number, currentPassword: string, newPassword: string): Promise<PasswordChangeResult> {
    try {
      // Get user
      const user = await this.getUserById(userId);
      if (!user) {
        return {
          success: false,
          message: "User not found",
        };
      }

      // Verify current password
      const isCurrentPasswordValid = await verifyPassword(currentPassword, user.passwordHash);
      if (!isCurrentPasswordValid) {
        return {
          success: false,
          message: "Current password is incorrect",
        };
      }

      // Validate new password strength
      const passwordValidation = validatePasswordStrength(newPassword);
      if (!passwordValidation.isValid) {
        return {
          success: false,
          message: passwordValidation.errors.join(", "),
        };
      }

      // Hash new password
      const newPasswordHash = await hashPassword(newPassword);

      // Update password
      await db
        .update(users)
        .set({
          passwordHash: newPasswordHash,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

      return {
        success: true,
        message: "Password changed successfully",
      };
    } catch (error) {
      console.error("Change password error:", error);
      return {
        success: false,
        message: "An error occurred while changing password",
      };
    }
  }

  /**
   * Deactivate user account
   */
  async deactivateUser(userId: number): Promise<CreateUserResult> {
    try {
      const [updatedUser] = await db
        .update(users)
        .set({
          isActive: false,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId))
        .returning();

      if (!updatedUser) {
        return {
          success: false,
          message: "User not found",
        };
      }

      return {
        success: true,
        message: "User deactivated successfully",
        user: updatedUser,
      };
    } catch (error) {
      console.error("Deactivate user error:", error);
      return {
        success: false,
        message: "An error occurred while deactivating the user",
      };
    }
  }

  /**
   * Reactivate user account
   */
  async reactivateUser(userId: number): Promise<CreateUserResult> {
    try {
      const [updatedUser] = await db
        .update(users)
        .set({
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId))
        .returning();

      if (!updatedUser) {
        return {
          success: false,
          message: "User not found",
        };
      }

      return {
        success: true,
        message: "User reactivated successfully",
        user: updatedUser,
      };
    } catch (error) {
      console.error("Reactivate user error:", error);
      return {
        success: false,
        message: "An error occurred while reactivating the user",
      };
    }
  }

  /**
   * Get all users (admin only)
   */
  async getAllUsers(): Promise<User[]> {
    try {
      const allUsers = await db.select().from(users);
      return allUsers;
    } catch (error) {
      console.error("Get all users error:", error);
      return [];
    }
  }

  /**
   * Generate token for a user
   */
  async generateTokenForUser(user: User): Promise<string> {
    return generateToken(user);
  }

  /**
   * Create default superuser if none exists
   */
  async createDefaultSuperuser(): Promise<void> {
    try {
      // Check if any superuser exists
      const [existingSuperuser] = await db
        .select()
        .from(users)
        .where(eq(users.role, "superuser"))
        .limit(1);

      if (existingSuperuser) {
        console.log("Superuser already exists");
        return;
      }

      // Create default superuser
      const defaultSuperuser: InsertUser = {
        firstName: "System",
        lastName: "Administrator",
        username: "admin",
        password: "Admin123!", // Should be changed on first login
        role: "superuser",
        position: "System Administrator",
        employeeNumber: "ADMIN001",
        email: "admin@company.com",
      };

      const result = await this.createUser(defaultSuperuser);
      if (result.success) {
        console.log("Default superuser created successfully");
        console.log("Username: admin, Password: Admin123!");
        console.log("Please change the default password after first login");
      } else {
        console.error("Failed to create default superuser:", result.message);
      }
    } catch (error) {
      console.error("Error creating default superuser:", error);
    }
  }
}