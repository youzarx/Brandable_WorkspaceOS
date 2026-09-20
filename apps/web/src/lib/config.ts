/**
 * Centralized Client-Side Configuration
 * Only public NEXT_PUBLIC_* variables are exposed to the browser.
 * Never place secrets or private keys here.
 */
export const WEB_CONFIG = {
  apiBaseUrl: process.env['NEXT_PUBLIC_API_URL'] || 'http://localhost:3001/api/v1',
  cookieName: 'refresh_token',
};
