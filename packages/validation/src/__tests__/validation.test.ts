import { describe, it, expect } from 'vitest';
import {
  loginSchema,
  registerSchema,
  createOrganizationSchema,
  inviteMemberSchema,
  createRoleSchema,
  toggleModuleSchema,
  paginationSchema,
  envSchema,
} from '../index.js';

describe('Validation Schemas', () => {
  describe('loginSchema', () => {
    it('validates correct email and password', () => {
      const result = loginSchema.safeParse({
        email: 'user@example.com',
        password: 'Password123!',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid email', () => {
      const result = loginSchema.safeParse({
        email: 'invalid-email',
        password: 'Password123!',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('registerSchema', () => {
    it('validates registration input', () => {
      const result = registerSchema.safeParse({
        email: 'newuser@example.com',
        password: 'SecurePassword123!',
        firstName: 'John',
        lastName: 'Doe',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('createOrganizationSchema', () => {
    it('validates organization creation', () => {
      const result = createOrganizationSchema.safeParse({
        name: 'Acme Corp',
        slug: 'acme-corp',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid slug format', () => {
      const result = createOrganizationSchema.safeParse({
        name: 'Acme Corp',
        slug: 'Acme Corp Invalid Slug!',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('inviteMemberSchema', () => {
    it('validates member invitation input', () => {
      const result = inviteMemberSchema.safeParse({
        email: 'member@example.com',
        roleId: 'role-123',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('createRoleSchema', () => {
    it('validates role creation input', () => {
      const result = createRoleSchema.safeParse({
        name: 'Custom Admin',
        description: 'Admin role with specific permissions',
        permissionIds: ['perm-1', 'perm-2'],
      });
      expect(result.success).toBe(true);
    });
  });

  describe('toggleModuleSchema', () => {
    it('validates module enable/disable', () => {
      const result = toggleModuleSchema.safeParse({
        moduleId: 'mod-123',
        isEnabled: true,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('paginationSchema', () => {
    it('provides defaults for page and pageSize', () => {
      const result = paginationSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.pageSize).toBe(20);
      }
    });
  });

  describe('envSchema', () => {
    it('validates required environment variables', () => {
      const result = envSchema.safeParse({
        NODE_ENV: 'test',
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
        JWT_ACCESS_SECRET: 'supersecretaccesskey12345678901234567890',
        COOKIE_SECRET: 'supersecretcookiekey12345678901234567890',
      });
      expect(result.success).toBe(true);
    });
  });
});
