import bcrypt from "bcryptjs";
import { passwordValidation } from "./config.js";

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12; // Higher salt rounds for better security
  return bcrypt.hash(password, saltRounds);
}

/**
 * Verify a password against its hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Validate password strength
 */
export function validatePasswordStrength(password: string): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (password.length < passwordValidation.minLength) {
    errors.push(`Password must be at least ${passwordValidation.minLength} characters long`);
  }
  
  if (passwordValidation.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }
  
  if (passwordValidation.requireLowercase && !/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }
  
  if (passwordValidation.requireNumbers && !/\d/.test(password)) {
    errors.push("Password must contain at least one number");
  }
  
  if (passwordValidation.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push("Password must contain at least one special character");
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Generate a random password
 */
export function generateRandomPassword(length: number = 12): string {
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const numbers = "0123456789";
  const special = "!@#$%^&*()";
  
  const allChars = uppercase + lowercase + numbers + special;
  let password = "";
  
  // Ensure at least one character from each required category
  if (passwordValidation.requireUppercase) {
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
  }
  if (passwordValidation.requireLowercase) {
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
  }
  if (passwordValidation.requireNumbers) {
    password += numbers[Math.floor(Math.random() * numbers.length)];
  }
  if (passwordValidation.requireSpecialChars) {
    password += special[Math.floor(Math.random() * special.length)];
  }
  
  // Fill the rest randomly
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  // Shuffle the password
  return password.split("").sort(() => 0.5 - Math.random()).join("");
}