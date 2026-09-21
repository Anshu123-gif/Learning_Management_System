import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthenticatedUserPayload {
  userId: string;
  email: string;
  role: "student" | "teacher" | "admin";
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUserPayload;
}

const JWT_SECRET = process.env.JWT_SECRET || "sheryians_lms_super_secure_jwt_secret_key_2025";

/**
 * requireAuth: Ensures the incoming request provides a valid Bearer JWT.
 * Attaches the verified decoded user payload to `req.user`.
 */
export const requireAuth = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Authentication required. Please provide a valid Bearer token.",
    });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthenticatedUserPayload;
    if (!decoded || !decoded.userId || !decoded.role) {
      return res.status(401).json({
        success: false,
        message: "Invalid session token payload.",
      });
    }
    req.user = decoded;
    return next();
  } catch (jwtErr) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired session token.",
    });
  }
};

/**
 * requireRole: Verifies that the authenticated user possesses one of the allowed roles.
 */
export const requireRole = (...roles: Array<"student" | "teacher" | "admin">) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden. Access requires one of the following roles: ${roles.join(", ")}.`,
      });
    }

    return next();
  };
};

/**
 * requireOwnerOrAdmin: Ensures that the authenticated user either owns the resource
 * (matching `req.params[paramKey]`) or has the "admin" role.
 */
export const requireOwnerOrAdmin = (paramKey: string = "userId") => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const requestedResourceOwner = req.params[paramKey];
    const isOwner = req.user.userId === requestedResourceOwner;
    const isAdmin = req.user.role === "admin";

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Forbidden. You are not authorized to view another user's records.",
      });
    }

    return next();
  };
};
