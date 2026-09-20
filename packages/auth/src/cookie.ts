import { AUTH_CONFIG } from '@platform/config';

export interface CookieOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'strict' | 'lax' | 'none';
  path: string;
  maxAge: number;
  domain?: string;
}

/**
 * Returns options for setting the refresh token HttpOnly cookie.
 * Scope: Path=/api/v1/auth
 * TTL: 7 days
 */
export function getRefreshCookieOptions(config: {
  nodeEnv: string;
  sameSite?: 'Strict' | 'Lax' | 'None';
  domain?: string;
}): CookieOptions {
  const isProduction = config.nodeEnv === 'production';
  const sameSiteRaw = (config.sameSite ?? 'Strict').toLowerCase() as 'strict' | 'lax' | 'none';

  return {
    httpOnly: true,
    secure: isProduction || sameSiteRaw === 'none',
    sameSite: sameSiteRaw,
    path: AUTH_CONFIG.COOKIE_PATH,
    maxAge: AUTH_CONFIG.REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
    ...(config.domain ? { domain: config.domain } : {}),
  };
}
