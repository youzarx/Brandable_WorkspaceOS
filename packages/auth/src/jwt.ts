import jwt from 'jsonwebtoken';
import type { JwtPayload } from '@platform/types';

/**
 * Signs a short-lived access JWT (15-minute TTL).
 * Minimal payload: { sub: userId, email }.
 * NEVER contains organizationId, roles, or permissions.
 */
export function signAccessToken(
  payload: { userId: string; email: string },
  secret: string,
  expiresIn: string = '15m',
): string {
  const options: jwt.SignOptions = {
    algorithm: 'HS256',
  };
  if (expiresIn) {
    options.expiresIn = expiresIn as NonNullable<jwt.SignOptions['expiresIn']>;
  }

  return jwt.sign(
    {
      sub: payload.userId,
      email: payload.email,
    },
    secret,
    options,
  );
}

/**
 * Verifies an access JWT against secret and returns decoded JwtPayload.
 * Throws on expired, invalid signature, or malformed token.
 */
export function verifyAccessToken(token: string, secret: string): JwtPayload {
  const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] });
  if (typeof decoded === 'string' || !decoded.sub || !decoded.email) {
    throw new Error('Invalid JWT payload format');
  }
  return {
    sub: decoded.sub,
    email: decoded.email as string,
    iat: decoded.iat ?? Math.floor(Date.now() / 1000),
    exp: decoded.exp ?? Math.floor(Date.now() / 1000) + 900,
  };
}
