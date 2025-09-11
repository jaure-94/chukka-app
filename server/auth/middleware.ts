import { Request, Response, NextFunction } from "express";
import { verifyToken, extractTokenFromHeader, type JwtPayload } from "./jwt.js";
import { cookieConfig, hasPermission, hasMinimumRole, type UserRole, type Permission } from "./config.js";

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: number;
        username: string;
        role: UserRole;
      };
    }
  }
}

/**
 * Authentication middleware - verifies JWT token
 */
export function authenticateToken(req: Request, res: Response, next: NextFunction) {
  // Try to get token from cookie first, then Authorization header
  let token = req.cookies?.[cookieConfig.name];
  
  if (!token) {
    token = extractTokenFromHeader(req.headers.authorization);
  }
  
  if (!token) {
    return res.status(401).json({ 
      error: "Access denied", 
      message: "No token provided" 
    });
  }
  
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ 
      error: "Access denied", 
      message: "Invalid or expired token" 
    });
  }
  
  req.user = payload;
  next();
}

/**
 * Optional authentication middleware - sets user if token is valid but doesn't require it
 */
export function optionalAuthentication(req: Request, res: Response, next: NextFunction) {
  let token = req.cookies?.[cookieConfig.name];
  
  if (!token) {
    token = extractTokenFromHeader(req.headers.authorization);
  }
  
  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      req.user = payload;
    }
  }
  
  next();
}

/**
 * Role-based authorization middleware
 */
export function requireRole(minimumRole: UserRole) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: "Authentication required", 
        message: "Please log in to access this resource" 
      });
    }
    
    const userRole = req.user.role as UserRole;
    if (!hasMinimumRole(userRole, minimumRole)) {
      return res.status(403).json({ 
        error: "Insufficient permissions", 
        message: `This action requires ${minimumRole} role or higher` 
      });
    }
    
    next();
  };
}

/**
 * Permission-based authorization middleware
 */
export function requirePermission(permission: Permission) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: "Authentication required", 
        message: "Please log in to access this resource" 
      });
    }
    
    const userRole = req.user.role as UserRole;
    if (!hasPermission(userRole, permission)) {
      return res.status(403).json({ 
        error: "Insufficient permissions", 
        message: `You don't have permission to: ${permission}` 
      });
    }
    
    next();
  };
}

/**
 * Admin or owner authorization - allows access if user is admin or owns the resource
 */
export function requireAdminOrOwner(getUserIdFromRequest: (req: Request) => number) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: "Authentication required", 
        message: "Please log in to access this resource" 
      });
    }
    
    const userRole = req.user.role as UserRole;
    const isAdmin = hasMinimumRole(userRole, "admin");
    const resourceUserId = getUserIdFromRequest(req);
    const isOwner = req.user.userId === resourceUserId;
    
    if (!isAdmin && !isOwner) {
      return res.status(403).json({ 
        error: "Insufficient permissions", 
        message: "You can only access your own resources or be an admin" 
      });
    }
    
    next();
  };
}

/**
 * Validate request body against schema
 */
export function validateRequest(schema: any) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = schema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({
          error: "Validation failed",
          message: "Invalid request data",
          details: result.error.issues.map((issue: any) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        });
      }
      
      req.body = result.data;
      next();
    } catch (error) {
      return res.status(400).json({
        error: "Validation error",
        message: "Failed to validate request data",
      });
    }
  };
}

/**
 * Rate limiting middleware (basic implementation)
 */
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export function rateLimit(maxRequests: number = 100, windowMs: number = 15 * 60 * 1000) {
  return (req: Request, res: Response, next: NextFunction) => {
    const clientId = req.ip || req.socket.remoteAddress || "unknown";
    const now = Date.now();
    
    // Clean up expired entries
    rateLimitStore.forEach((value, key) => {
      if (now > value.resetTime) {
        rateLimitStore.delete(key);
      }
    });
    
    const clientData = rateLimitStore.get(clientId);
    
    if (!clientData) {
      rateLimitStore.set(clientId, { count: 1, resetTime: now + windowMs });
      return next();
    }
    
    if (now > clientData.resetTime) {
      clientData.count = 1;
      clientData.resetTime = now + windowMs;
      return next();
    }
    
    if (clientData.count >= maxRequests) {
      return res.status(429).json({
        error: "Too many requests",
        message: "Rate limit exceeded. Please try again later.",
        retryAfter: Math.ceil((clientData.resetTime - now) / 1000),
      });
    }
    
    clientData.count++;
    next();
  };
}