// server/src/middleware/auth.ts
// JWT Authentication, RBAC, Customer Isolation & Resource Ownership
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export interface AuthTokenPayload {
  userId: string;
  email: string;
  role: 'operator' | 'admin' | 'viewer';
  name?: string;
  iat?: number;
  exp?: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthTokenPayload;
    }
  }
}

/**
 * Signs a new JWT access token with user identity, role, and expiration
 */
export function signAccessToken(
  payload: Omit<AuthTokenPayload, 'iat' | 'exp'>,
  expiresIn?: string
): string {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: (expiresIn || config.jwtExpiresIn) as any,
    algorithm: 'HS256',
  });
}

/**
 * Middleware factory to require valid JWT authentication and optional role authorization.
 * Rejects missing, invalid, expired tokens, and insufficient roles.
 */
export function requireAuth(allowedRoles?: ('operator' | 'admin' | 'viewer')[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // Check if fallback operator key was provided (e.g., during programmatic test integration)
      const providedKey = req.headers['x-operator-key'] as string | undefined;
      if (providedKey && timingSafeEqual(providedKey, config.operatorApiKey)) {
        req.user = {
          userId: 'usr-operator-system',
          email: config.operatorEmail,
          role: 'operator',
          name: 'System Operator',
        };
        return next();
      }

      res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing or malformed Authorization header. Expected Bearer <token>',
      });
      return;
    }

    const token = authHeader.slice(7).trim();

    try {
      const decoded = jwt.verify(token, config.jwtSecret, {
        algorithms: ['HS256'],
      }) as AuthTokenPayload;

      // Role check
      if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(decoded.role)) {
        res.status(403).json({
          error: 'Forbidden',
          message: `Insufficient permissions. Role '${decoded.role}' is not authorized for this operation.`,
        });
        return;
      }

      req.user = decoded;
      next();
    } catch (err: any) {
      if (err instanceof jwt.TokenExpiredError) {
        res.status(401).json({
          error: 'Unauthorized',
          code: 'TOKEN_EXPIRED',
          message: 'Authentication token has expired. Please refresh your session.',
        });
        return;
      }

      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or forged authentication token.',
      });
      return;
    }
  };
}

/**
 * Resource ownership verification to enforce tenant and customer isolation.
 * Prevents horizontal privilege escalation where one user modifies another's resources.
 */
export function verifyOwnership(getResourceOwnerId: (req: Request) => string | undefined | null) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
      return;
    }

    // Admins and operators can operate across resources if within vault permissions
    if (req.user.role === 'admin' || req.user.role === 'operator') {
      return next();
    }

    const ownerId = getResourceOwnerId(req);
    if (ownerId && ownerId !== req.user.userId) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied: You do not have permission to access or modify this resource.',
      });
      return;
    }

    next();
  };
}

/**
 * Constant-time comparison to prevent timing attacks
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    let result = 1;
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      result |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
    }
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// Aliases for clean route definitions
export const requireOperatorAuth = requireAuth(['operator', 'admin']);
export const requireAnyAuth = requireAuth();
export const requireApiKey = requireOperatorAuth;
