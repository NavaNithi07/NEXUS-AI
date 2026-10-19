// server/src/auth/service.ts
// Enterprise-grade password hashing (scrypt), account lockout, and token management
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import type { AuthTokenPayload } from '../middleware/auth.js';

// ── Password Hashing using Scrypt (OWASP Recommended) ──────────────────────
const SCRYPT_KEYLEN = 64;
const SCRYPT_COST = 16384; // N = 2^14
const SCRYPT_BLOCK_SIZE = 8; // r = 8
const SCRYPT_PARALLELIZATION = 1; // p = 1

/**
 * Hash a plaintext password with a random cryptographic salt using scrypt
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  return new Promise((resolve, reject) => {
    crypto.scrypt(
      password,
      salt,
      SCRYPT_KEYLEN,
      { N: SCRYPT_COST, r: SCRYPT_BLOCK_SIZE, p: SCRYPT_PARALLELIZATION },
      (err, derivedKey) => {
        if (err) return reject(err);
        resolve(`${salt}:${derivedKey.toString('hex')}`);
      }
    );
  });
}

/**
 * Verify a plaintext password against a stored salt:hash string using constant-time comparison
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, key] = parts;

  return new Promise((resolve, reject) => {
    crypto.scrypt(
      password,
      salt,
      SCRYPT_KEYLEN,
      { N: SCRYPT_COST, r: SCRYPT_BLOCK_SIZE, p: SCRYPT_PARALLELIZATION },
      (err, derivedKey) => {
        if (err) return reject(err);
        const keyBuffer = Buffer.from(key, 'hex');
        if (keyBuffer.length !== derivedKey.length) {
          return resolve(false);
        }
        resolve(crypto.timingSafeEqual(keyBuffer, derivedKey));
      }
    );
  });
}

// ── Account Lockout Tracking ────────────────────────────────────────────────
interface FailedAttemptTracker {
  count: number;
  lockoutUntil: number | null;
  lastAttemptAt: number;
}

const failedAttemptsMap = new Map<string, FailedAttemptTracker>();

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const WINDOW_DURATION_MS = 15 * 60 * 1000;  // 15 minutes reset window

/**
 * Checks if an account/IP is currently locked out
 */
export function checkAccountLockout(identifier: string): { isLocked: boolean; remainingSeconds: number } {
  const now = Date.now();
  const tracker = failedAttemptsMap.get(identifier.toLowerCase());

  if (!tracker || !tracker.lockoutUntil) {
    return { isLocked: false, remainingSeconds: 0 };
  }

  if (now < tracker.lockoutUntil) {
    const remainingSeconds = Math.ceil((tracker.lockoutUntil - now) / 1000);
    return { isLocked: true, remainingSeconds };
  }

  // Lockout expired, reset counter
  failedAttemptsMap.delete(identifier.toLowerCase());
  return { isLocked: false, remainingSeconds: 0 };
}

/**
 * Records a failed login attempt and engages temporary lockout if limit reached
 */
export function recordFailedAttempt(identifier: string): { isNowLocked: boolean; remainingAttempts: number } {
  const key = identifier.toLowerCase();
  const now = Date.now();
  const tracker = failedAttemptsMap.get(key) || { count: 0, lockoutUntil: null, lastAttemptAt: now };

  // Reset if last attempt was outside window
  if (now - tracker.lastAttemptAt > WINDOW_DURATION_MS) {
    tracker.count = 0;
    tracker.lockoutUntil = null;
  }

  tracker.count += 1;
  tracker.lastAttemptAt = now;

  if (tracker.count >= MAX_FAILED_ATTEMPTS) {
    tracker.lockoutUntil = now + LOCKOUT_DURATION_MS;
    failedAttemptsMap.set(key, tracker);
    return { isNowLocked: true, remainingAttempts: 0 };
  }

  failedAttemptsMap.set(key, tracker);
  return { isNowLocked: false, remainingAttempts: MAX_FAILED_ATTEMPTS - tracker.count };
}

/**
 * Clears failed attempts upon successful authentication
 */
export function clearFailedAttempts(identifier: string): void {
  failedAttemptsMap.delete(identifier.toLowerCase());
}

// ── Refresh Token Management ───────────────────────────────────────────────
export interface RefreshTokenRecord {
  tokenHash: string;
  userId: string;
  email: string;
  role: 'operator' | 'admin' | 'viewer';
  expiresAt: number;
  revoked: boolean;
  createdAt: number;
}

// In-memory fallback token store (synchronized to DB in persistence layer)
const refreshTokens = new Map<string, RefreshTokenRecord>();

/**
 * Generates a cryptographically secure random refresh token (32 bytes hex)
 */
export function generateRefreshToken(user: { userId: string; email: string; role: 'operator' | 'admin' | 'viewer' }): {
  refreshToken: string;
  expiresInSeconds: number;
} {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresInSeconds = 7 * 24 * 60 * 60; // 7 days
  const expiresAt = Date.now() + expiresInSeconds * 1000;

  refreshTokens.set(tokenHash, {
    tokenHash,
    userId: user.userId,
    email: user.email,
    role: user.role,
    expiresAt,
    revoked: false,
    createdAt: Date.now(),
  });

  return { refreshToken: rawToken, expiresInSeconds };
}

/**
 * Validates and rotates a refresh token. Revokes old token and issues a new pair.
 */
export function rotateRefreshToken(rawToken: string): {
  valid: boolean;
  user?: { userId: string; email: string; role: 'operator' | 'admin' | 'viewer' };
  newRefreshToken?: string;
  error?: string;
} {
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const record = refreshTokens.get(tokenHash);

  if (!record) {
    return { valid: false, error: 'Invalid or unrecognized refresh token.' };
  }

  if (record.revoked) {
    // Potential token theft: Revoke all tokens for this user
    for (const [hash, r] of refreshTokens.entries()) {
      if (r.userId === record.userId) {
        r.revoked = true;
      }
    }
    return { valid: false, error: 'Refresh token was previously revoked. Suspicious token reuse detected.' };
  }

  if (Date.now() > record.expiresAt) {
    refreshTokens.delete(tokenHash);
    return { valid: false, error: 'Refresh token has expired.' };
  }

  // Revoke the used token (one-time use rotation)
  record.revoked = true;

  // Issue new refresh token
  const newRawToken = crypto.randomBytes(32).toString('hex');
  const newTokenHash = crypto.createHash('sha256').update(newRawToken).digest('hex');
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;

  refreshTokens.set(newTokenHash, {
    tokenHash: newTokenHash,
    userId: record.userId,
    email: record.email,
    role: record.role,
    expiresAt,
    revoked: false,
    createdAt: Date.now(),
  });

  return {
    valid: true,
    user: {
      userId: record.userId,
      email: record.email,
      role: record.role,
    },
    newRefreshToken: newRawToken,
  };
}

/**
 * Revokes a refresh token (e.g. on logout)
 */
export function revokeRefreshToken(rawToken: string): boolean {
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const record = refreshTokens.get(tokenHash);
  if (record) {
    record.revoked = true;
    return true;
  }
  return false;
}
