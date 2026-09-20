import { describe, it, expect } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  generateRawRefreshToken,
  hashRefreshToken,
  generateFamilyId,
  signAccessToken,
  verifyAccessToken,
  getRefreshCookieOptions,
} from '../index.js';

describe('@platform/auth utilities', () => {
  const testSecret = 'super-secret-jwt-key-minimum-32-characters!';

  describe('Password Hashing', () => {
    it('hashes password with bcrypt (cost >= 12)', async () => {
      const hash = await hashPassword('SecurePassword123!');
      expect(hash).not.toEqual('SecurePassword123!');
      expect(hash.startsWith('$2b$12$') || hash.startsWith('$2a$12$')).toBe(true);
    });

    it('verifies correct password', async () => {
      const hash = await hashPassword('MySecretPass123!');
      const isValid = await verifyPassword('MySecretPass123!', hash);
      expect(isValid).toBe(true);
    });

    it('rejects incorrect password', async () => {
      const hash = await hashPassword('MySecretPass123!');
      const isValid = await verifyPassword('WrongPassword!', hash);
      expect(isValid).toBe(false);
    });
  });

  describe('Crypto Helpers', () => {
    it('generates 64-byte raw refresh token (128 hex chars)', () => {
      const raw = generateRawRefreshToken();
      expect(typeof raw).toBe('string');
      expect(raw).toHaveLength(128);
    });

    it('consistently hashes refresh tokens with SHA-256', () => {
      const raw = 'test-token-string';
      const hash1 = hashRefreshToken(raw);
      const hash2 = hashRefreshToken(raw);
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 hex string length
    });

    it('generates valid UUID v4 family IDs', () => {
      const familyId = generateFamilyId();
      expect(familyId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    });
  });

  describe('JWT Access Tokens', () => {
    it('signs and verifies JWT access token with sub and email', () => {
      const token = signAccessToken({ userId: 'user-123', email: 'user@example.com' }, testSecret);
      const payload = verifyAccessToken(token, testSecret);
      expect(payload.sub).toBe('user-123');
      expect(payload.email).toBe('user@example.com');
      expect(payload.exp).toBeGreaterThan(payload.iat);
    });

    it('rejects JWT signed with wrong secret', () => {
      const token = signAccessToken({ userId: 'user-123', email: 'user@example.com' }, testSecret);
      expect(() => verifyAccessToken(token, 'wrong-secret-key')).toThrow();
    });
  });

  describe('Cookie Options', () => {
    it('returns HttpOnly cookie options with Path=/api/v1/auth', () => {
      const options = getRefreshCookieOptions({
        nodeEnv: 'development',
        sameSite: 'Strict',
      });
      expect(options.httpOnly).toBe(true);
      expect(options.path).toBe('/api/v1/auth');
      expect(options.sameSite).toBe('strict');
      expect(options.maxAge).toBe(7 * 24 * 60 * 60 * 1000);
    });
  });
});
