// server/src/auth/service.ts
// Enterprise-grade password hashing (scrypt), account lockout, and token management
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import type { AuthTokenPayload } from '../middleware/auth.js';
import { getDb } from '../db/database.js';
import { getNeonPool, queryNeon } from '../db/neon.js';

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

// ── Account Lockout Tracking with Database Durability ───────────────────────
interface FailedAttemptTracker {
  count: number;
  lockoutUntil: number | null;
  lastAttemptAt: number;
}

const failedAttemptsMap = new Map<string, FailedAttemptTracker>();

// Load unexpired lockouts from DB on initialization
try {
  const db = getDb();
  const lockedUsers = db.prepare('SELECT email, failed_attempts, lockout_until FROM users WHERE lockout_until IS NOT NULL AND lockout_until > ?').all(Date.now()) as any[];
  for (const u of lockedUsers) {
    failedAttemptsMap.set(u.email.toLowerCase(), {
      count: Number(u.failed_attempts || 0),
      lockoutUntil: Number(u.lockout_until),
      lastAttemptAt: Date.now(),
    });
  }
} catch { /* schema initialized lazily */ }

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const WINDOW_DURATION_MS = 15 * 60 * 1000;  // 15 minutes reset window

/**
 * Checks if an account/IP is currently locked out
 */
export function checkAccountLockout(identifier: string): { isLocked: boolean; remainingSeconds: number } {
  const now = Date.now();
  const key = identifier.toLowerCase();
  const tracker = failedAttemptsMap.get(key);

  if (!tracker || !tracker.lockoutUntil) {
    return { isLocked: false, remainingSeconds: 0 };
  }

  if (now < tracker.lockoutUntil) {
    const remainingSeconds = Math.ceil((tracker.lockoutUntil - now) / 1000);
    return { isLocked: true, remainingSeconds };
  }

  // Lockout expired, reset counter in memory and DB
  failedAttemptsMap.delete(key);
  try {
    const db = getDb();
    db.prepare('UPDATE users SET failed_attempts = 0, lockout_until = NULL WHERE email = ?').run(key);
  } catch {}
  if (getNeonPool()) {
    queryNeon('UPDATE users SET failed_attempts = 0, lockout_until = NULL WHERE email = $1', [key]).catch(() => {});
  }

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

    // Persist lockout to DB
    try {
      const db = getDb();
      db.prepare(`
        INSERT INTO users (id, email, password_hash, role, failed_attempts, lockout_until, created_at)
        VALUES (?, ?, 'LOCKOUT_PLACEHOLDER', 'operator', ?, ?, datetime('now'))
        ON CONFLICT (email) DO UPDATE SET failed_attempts = EXCLUDED.failed_attempts, lockout_until = EXCLUDED.lockout_until;
      `).run(`usr-${key}`, key, tracker.count, tracker.lockoutUntil);
    } catch {}
    if (getNeonPool()) {
      queryNeon(`
        INSERT INTO users (id, email, password_hash, role, failed_attempts, lockout_until, created_at)
        VALUES ($1, $2, 'LOCKOUT_PLACEHOLDER', 'operator', $3, $4, NOW()::text)
        ON CONFLICT (email) DO UPDATE SET failed_attempts = EXCLUDED.failed_attempts, lockout_until = EXCLUDED.lockout_until;
      `, [`usr-${key}`, key, tracker.count, tracker.lockoutUntil]).catch(() => {});
    }

    return { isNowLocked: true, remainingAttempts: 0 };
  }

  failedAttemptsMap.set(key, tracker);
  return { isNowLocked: false, remainingAttempts: MAX_FAILED_ATTEMPTS - tracker.count };
}

/**
 * Clears failed attempts upon successful authentication
 */
export function clearFailedAttempts(identifier: string): void {
  const key = identifier.toLowerCase();
  failedAttemptsMap.delete(key);
  try {
    const db = getDb();
    db.prepare('UPDATE users SET failed_attempts = 0, lockout_until = NULL WHERE email = ?').run(key);
  } catch {}
  if (getNeonPool()) {
    queryNeon('UPDATE users SET failed_attempts = 0, lockout_until = NULL WHERE email = $1', [key]).catch(() => {});
  }
}

// ── Refresh Token Management with Database Durability ──────────────────────
export interface RefreshTokenRecord {
  tokenHash: string;
  userId: string;
  email: string;
  role: 'operator' | 'admin' | 'viewer';
  expiresAt: number;
  revoked: boolean;
  createdAt: number;
}

const refreshTokens = new Map<string, RefreshTokenRecord>();

// Pre-load unexpired active refresh tokens on startup
try {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM refresh_tokens WHERE expires_at > ?').all(Date.now()) as any[];
  for (const r of rows) {
    refreshTokens.set(r.token_hash, {
      tokenHash: r.token_hash,
      userId: r.user_id,
      email: r.email,
      role: r.role,
      expiresAt: Number(r.expires_at),
      revoked: Boolean(r.revoked),
      createdAt: Number(r.created_at),
    });
  }
} catch { /* schema initialized lazily */ }

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

  const record: RefreshTokenRecord = {
    tokenHash,
    userId: user.userId,
    email: user.email,
    role: user.role,
    expiresAt,
    revoked: false,
    createdAt: Date.now(),
  };

  refreshTokens.set(tokenHash, record);

  // Persist to SQLite
  try {
    const db = getDb();
    db.prepare(`
      INSERT OR REPLACE INTO refresh_tokens (token_hash, user_id, email, role, expires_at, revoked, created_at)
      VALUES (?, ?, ?, ?, ?, 0, ?)
    `).run(tokenHash, user.userId, user.email, user.role, expiresAt, Date.now());
  } catch {}

  // Persist to Neon
  if (getNeonPool()) {
    queryNeon(`
      INSERT INTO refresh_tokens (token_hash, user_id, email, role, expires_at, revoked, created_at)
      VALUES ($1, $2, $3, $4, $5, false, $6)
      ON CONFLICT (token_hash) DO UPDATE SET expires_at = EXCLUDED.expires_at, revoked = EXCLUDED.revoked;
    `, [tokenHash, user.userId, user.email, user.role, expiresAt, Date.now()]).catch(() => {});
  }

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
  let record = refreshTokens.get(tokenHash);

  // Fallback to SQLite if not in memory
  if (!record) {
    try {
      const db = getDb();
      const r = db.prepare('SELECT * FROM refresh_tokens WHERE token_hash = ?').get(tokenHash) as any;
      if (r) {
        record = {
          tokenHash: r.token_hash,
          userId: r.user_id,
          email: r.email,
          role: r.role,
          expiresAt: Number(r.expires_at),
          revoked: Boolean(r.revoked),
          createdAt: Number(r.created_at),
        };
        refreshTokens.set(tokenHash, record);
      }
    } catch {}
  }

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
    try {
      const db = getDb();
      db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE user_id = ?').run(record.userId);
    } catch {}
    if (getNeonPool()) {
      queryNeon('UPDATE refresh_tokens SET revoked = true WHERE user_id = $1', [record.userId]).catch(() => {});
    }
    return { valid: false, error: 'Refresh token was previously revoked. Suspicious token reuse detected.' };
  }

  if (Date.now() > record.expiresAt) {
    refreshTokens.delete(tokenHash);
    try {
      const db = getDb();
      db.prepare('DELETE FROM refresh_tokens WHERE token_hash = ?').run(tokenHash);
    } catch {}
    return { valid: false, error: 'Refresh token has expired.' };
  }

  // Revoke the used token (one-time use rotation)
  record.revoked = true;
  try {
    const db = getDb();
    db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE token_hash = ?').run(tokenHash);
  } catch {}
  if (getNeonPool()) {
    queryNeon('UPDATE refresh_tokens SET revoked = true WHERE token_hash = $1', [tokenHash]).catch(() => {});
  }

  // Issue new refresh token
  const newRawToken = crypto.randomBytes(32).toString('hex');
  const newTokenHash = crypto.createHash('sha256').update(newRawToken).digest('hex');
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;

  const newRecord: RefreshTokenRecord = {
    tokenHash: newTokenHash,
    userId: record.userId,
    email: record.email,
    role: record.role,
    expiresAt,
    revoked: false,
    createdAt: Date.now(),
  };

  refreshTokens.set(newTokenHash, newRecord);

  try {
    const db = getDb();
    db.prepare(`
      INSERT OR REPLACE INTO refresh_tokens (token_hash, user_id, email, role, expires_at, revoked, created_at)
      VALUES (?, ?, ?, ?, ?, 0, ?)
    `).run(newTokenHash, record.userId, record.email, record.role, expiresAt, Date.now());
  } catch {}

  if (getNeonPool()) {
    queryNeon(`
      INSERT INTO refresh_tokens (token_hash, user_id, email, role, expires_at, revoked, created_at)
      VALUES ($1, $2, $3, $4, $5, false, $6)
      ON CONFLICT (token_hash) DO UPDATE SET expires_at = EXCLUDED.expires_at, revoked = EXCLUDED.revoked;
    `, [newTokenHash, record.userId, record.email, record.role, expiresAt, Date.now()]).catch(() => {});
  }

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
  }

  try {
    const db = getDb();
    db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE token_hash = ?').run(tokenHash);
  } catch {}

  if (getNeonPool()) {
    queryNeon('UPDATE refresh_tokens SET revoked = true WHERE token_hash = $1', [tokenHash]).catch(() => {});
  }

  return Boolean(record);
}

/**
 * Register a new operator account with scrypt password hashing
 */
export async function registerUser(
  email: string,
  password: string,
  name?: string,
  role: 'operator' | 'admin' | 'viewer' = 'operator'
): Promise<{ userId: string; email: string; role: 'operator' | 'admin' | 'viewer'; name: string }> {
  const normalizedEmail = email.trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new Error('Invalid email address format.');
  }

  if (!password || password.length < 6) {
    throw new Error('Password must be at least 6 characters.');
  }

  const db = getDb();

  // Check default operator email
  if (normalizedEmail === config.operatorEmail.toLowerCase()) {
    throw new Error('An account with this email address already exists.');
  }

  // Check local database
  const existingLocal = db.prepare('SELECT id FROM users WHERE LOWER(email) = ?').get(normalizedEmail);
  if (existingLocal) {
    throw new Error('An account with this email address already exists.');
  }

  // Check Neon if available
  if (getNeonPool()) {
    try {
      const neonRes = await queryNeon('SELECT id FROM users WHERE LOWER(email) = $1', [normalizedEmail]);
      if (neonRes && neonRes.rows.length > 0) {
        throw new Error('An account with this email address already exists.');
      }
    } catch (err: any) {
      if (err.message.includes('already exists')) throw err;
    }
  }

  const passwordHash = await hashPassword(password);
  const userId = `usr-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`;
  const userName = (name && name.trim()) ? name.trim() : normalizedEmail.split('@')[0];
  const createdAt = new Date().toISOString();

  db.prepare(`
    INSERT INTO users (id, email, password_hash, name, role, failed_attempts, created_at)
    VALUES (?, ?, ?, ?, ?, 0, ?)
  `).run(userId, normalizedEmail, passwordHash, userName, role, createdAt);

  if (getNeonPool()) {
    queryNeon(`
      INSERT INTO users (id, email, password_hash, name, role, failed_attempts, created_at)
      VALUES ($1, $2, $3, $4, $5, 0, $6)
      ON CONFLICT (email) DO NOTHING
    `, [userId, normalizedEmail, passwordHash, userName, role, createdAt]).catch((e) => {
      console.warn('[Auth Service] Neon user sync:', e.message);
    });
  }

  return {
    userId,
    email: normalizedEmail,
    role,
    name: userName,
  };
}

/**
 * Authoritatively authenticate a user against the operator credentials or the persistent user database
 */
export async function authenticateUser(
  email: string,
  password: string
): Promise<{ userId: string; email: string; role: 'operator' | 'admin' | 'viewer'; name: string } | null> {
  const normalizedEmail = email.trim().toLowerCase();

  // 1. Check default environment operator credentials
  const isDefaultOperatorEmail = normalizedEmail === config.operatorEmail.toLowerCase();
  const isDefaultOperatorPassword = String(password) === config.operatorPassword;
  if (isDefaultOperatorEmail && isDefaultOperatorPassword) {
    return {
      userId: 'usr-operator-01',
      email: config.operatorEmail,
      role: 'operator',
      name: 'Chief Treasury Operator',
    };
  }

  // 2. Query persistent database
  const db = getDb();
  let record: any = null;
  try {
    record = db.prepare('SELECT id, email, password_hash, name, role FROM users WHERE LOWER(email) = ?').get(normalizedEmail);
  } catch {}

  if (!record && getNeonPool()) {
    try {
      const neonRes = await queryNeon('SELECT id, email, password_hash, name, role FROM users WHERE LOWER(email) = $1', [normalizedEmail]);
      if (neonRes && neonRes.rows.length > 0) {
        record = neonRes.rows[0];
      }
    } catch {}
  }

  if (!record || !record.password_hash) {
    return null;
  }

  const isPasswordValid = await verifyPassword(String(password), record.password_hash);
  if (!isPasswordValid) {
    return null;
  }

  return {
    userId: record.id,
    email: record.email,
    role: (record.role as any) || 'operator',
    name: record.name || record.email.split('@')[0],
  };
}

