/**
 * JWT access token payload shape.
 * Contains ONLY: sub (userId), email, iat, exp.
 * No organizationId. No role claims.
 */
export interface JwtPayload {
  /** User ID */
  sub: string;
  /** User email */
  email: string;
  /** Issued at (epoch seconds) */
  iat: number;
  /** Expires at (epoch seconds) */
  exp: number;
}

/**
 * Authenticated user identity extracted from a validated JWT.
 * Used by JwtAuthGuard to populate req.user.
 */
export interface AuthenticatedUser {
  userId: string;
  email: string;
}

/**
 * Response shape for successful authentication.
 * The refresh token is delivered via httpOnly cookie, not in the response body.
 */
export interface TokenResponse {
  accessToken: string;
}

/**
 * Internal result of a refresh token rotation operation.
 * Not exposed to clients.
 */
export interface RefreshTokenResult {
  accessToken: string;
  /** Raw refresh token to be set in httpOnly cookie */
  rawRefreshToken: string;
}
