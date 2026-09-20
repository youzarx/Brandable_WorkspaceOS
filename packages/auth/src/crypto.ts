import crypto from 'crypto';
import { AUTH_CONFIG } from '@platform/config';

/**
 * Generates a cryptographically secure random raw refresh token.
 * 64 random bytes encoded as hex string (128 characters).
 */
export function generateRawRefreshToken(): string {
  return crypto.randomBytes(AUTH_CONFIG.REFRESH_TOKEN_BYTES).toString('hex');
}

/**
 * Computes SHA-256 hash of a raw refresh token string.
 * Only hashed refresh tokens are persisted in PostgreSQL.
 */
export function hashRefreshToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

/**
 * Generates a unique family ID (UUID v4) for token rotation family tracking.
 */
export function generateFamilyId(): string {
  return crypto.randomUUID();
}
