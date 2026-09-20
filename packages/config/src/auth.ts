/**
 * Authentication and security constants.
 * These are configuration defaults — NOT implementation.
 * Actual auth logic belongs to the API auth module (Phase 3+).
 */

/** Default JWT access token expiry */
export const JWT_ACCESS_EXPIRY_DEFAULT = '15m';

/** Default refresh token expiry in days */
export const REFRESH_TOKEN_EXPIRY_DAYS_DEFAULT = 7;

/** bcrypt cost factor (minimum) */
export const BCRYPT_ROUNDS_DEFAULT = 12;

/** Size of the raw refresh token in bytes (crypto.randomBytes) */
export const REFRESH_TOKEN_BYTES = 64;

/**
 * Cookie configuration constants.
 */
export const COOKIE_CONFIG = {
  /** Cookie name for the refresh token */
  NAME: 'refresh_token',
  /** Cookie path — scoped to auth endpoints only */
  PATH: '/api/v1/auth',
  /** Cookie max-age in seconds (7 days) */
  MAX_AGE: 7 * 24 * 60 * 60,
} as const;
