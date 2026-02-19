import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from './error.middleware';

export interface JwtPayload {
  sub: string;
  email: string;
  accountType: string;
  groupId?: string | null;
  iat?: number;
  exp?: number;
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
        accountType: string;
        groupId?: string | null;
      };
    }
  }
}

export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      throw new AppError('Authentication required', 401);
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new AppError('JWT_SECRET not configured', 500);
    }

    // Debug: Log first/last chars of secret (don't log full secret for security)
    console.log(`[Auth] JWT_SECRET length: ${secret.length}, starts: ${secret.substring(0, 5)}..., ends: ...${secret.substring(secret.length - 5)}`);

    const payload = jwt.verify(token, secret) as JwtPayload;

    req.user = {
      userId: payload.sub,
      email: payload.email,
      accountType: payload.accountType,
      groupId: payload.groupId,
    };

    next();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Invalid token';
    next(new AppError(message, 401));
  }
}

// Role-based middleware
export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }

    if (!roles.includes(req.user.accountType)) {
      return next(new AppError('Insufficient permissions', 403));
    }

    next();
  };
}
