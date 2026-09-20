import bcrypt from 'bcrypt';
import { AUTH_CONFIG } from '@platform/config';

/**
 * Hashes a plaintext password using bcrypt with cost factor >= 12.
 * Password hashing happens strictly server-side.
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, AUTH_CONFIG.PASSWORD_SALT_ROUNDS);
}

/**
 * Verifies a plaintext password against a bcrypt hash in constant time.
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
