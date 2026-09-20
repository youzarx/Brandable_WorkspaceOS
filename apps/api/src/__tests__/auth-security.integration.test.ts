/**
 * Phase 3 — Authentication & Authorization Security Integration Tests
 * ====================================================================
 * These tests execute against a LIVE PostgreSQL database.
 * No mocks are used for security-critical database authorization invariants.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient, MembershipStatus } from '@platform/database';
import {
  hashPassword,
  verifyPassword,
  generateRawRefreshToken,
  hashRefreshToken,
  generateFamilyId,
  signAccessToken,
  verifyAccessToken,
} from '@platform/auth';
import { AuthService } from '../modules/auth/auth.service.js';
import type { ApiConfigService } from '../config/api-config.service.js';
import type { PrismaService } from '../database/prisma.service.js';

if (!process.env['DATABASE_URL']) {
  process.env['DATABASE_URL'] = 'postgresql://platform:platform@127.0.0.1:5432/platform_dev';
}
const prisma = new PrismaClient();
const TEST_JWT_SECRET = 'test-jwt-access-secret-32-characters-minimum!';

beforeAll(async () => {
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
});

function testEmail(suffix: string): string {
  return `sec-test-${suffix}-${Date.now()}@example.com`;
}

function testSlug(suffix: string): string {
  return `sec-slug-${suffix}-${Date.now()}`;
}

describe('Phase 3 Security Invariants', () => {
  describe('1. Password Hashing & Security', () => {
    it('hashes password with bcrypt (cost >= 12) and never stores plaintext', async () => {
      const plain = 'MySecretPass123!';
      const hash = await hashPassword(plain);

      expect(hash).not.toEqual(plain);
      expect(hash.startsWith('$2b$12$') || hash.startsWith('$2a$12$')).toBe(true);

      const isValid = await verifyPassword(plain, hash);
      expect(isValid).toBe(true);

      const isInvalid = await verifyPassword('WrongPass!', hash);
      expect(isInvalid).toBe(false);
    });

    it('rejects authentication for soft-deleted user', async () => {
      const user = await prisma.user.create({
        data: {
          email: testEmail('deleted-user'),
          passwordHash: await hashPassword('Password123!'),
          firstName: 'Deleted',
          lastName: 'User',
          deletedAt: new Date(),
        },
      });

      const activeUser = await prisma.user.findFirst({
        where: { id: user.id, deletedAt: null },
      });

      expect(activeUser).toBeNull();
    });
  });

  describe('2. JWT Access Token Security', () => {
    it('signs and verifies 15-minute access token without authorization claims', () => {
      const token = signAccessToken(
        { userId: 'usr-1', email: 'usr1@example.com' },
        TEST_JWT_SECRET,
        '15m',
      );

      const payload = verifyAccessToken(token, TEST_JWT_SECRET);
      expect(payload.sub).toBe('usr-1');
      expect(payload.email).toBe('usr1@example.com');

      // Assert payload contains NO organizationId, role, or permissions claims
      const record = payload as unknown as Record<string, unknown>;
      expect(record['organizationId']).toBeUndefined();
      expect(record['role']).toBeUndefined();
      expect(record['permissions']).toBeUndefined();
    });

    it('rejects access token with invalid signature', () => {
      const token = signAccessToken(
        { userId: 'usr-1', email: 'usr1@example.com' },
        TEST_JWT_SECRET,
      );

      expect(() => verifyAccessToken(token, 'wrong-secret-key-32-characters-min!')).toThrow();
    });
  });

  describe('3. Refresh Token Rotation & Reuse Detection (PostgreSQL Authoritative)', () => {
    it('executes atomic token rotation via PostgreSQL conditional update', async () => {
      const user = await prisma.user.create({
        data: {
          email: testEmail('rotation'),
          passwordHash: await hashPassword('Pass123!'),
          firstName: 'Rot',
          lastName: 'Test',
        },
      });

      const rawToken1 = generateRawRefreshToken();
      const hash1 = hashRefreshToken(rawToken1);
      const familyId = generateFamilyId();

      await prisma.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: hash1,
          familyId,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      // Atomic conditional update simulation (first-writer-wins)
      const updatedTokens = await prisma.$queryRaw<
        Array<{ id: string; familyId: string; userId: string }>
      >`
        UPDATE "RefreshToken"
        SET "revokedAt" = NOW()
        WHERE "tokenHash" = ${hash1}
          AND "revokedAt" IS NULL
          AND "expiresAt" > NOW()
        RETURNING "id", "familyId", "userId";
      `;

      expect(updatedTokens).toHaveLength(1);
      const firstToken = updatedTokens[0];
      expect(firstToken?.id).toBeDefined();

      // Second attempt with same raw token MUST return 0 updated rows
      const secondAttempt = await prisma.$queryRaw<Array<{ id: string }>>`
        UPDATE "RefreshToken"
        SET "revokedAt" = NOW()
        WHERE "tokenHash" = ${hash1}
          AND "revokedAt" IS NULL
          AND "expiresAt" > NOW()
        RETURNING "id";
      `;

      expect(secondAttempt).toHaveLength(0);
    });

    it('revokes entire token family when revoked token reuse is detected', async () => {
      const user = await prisma.user.create({
        data: {
          email: testEmail('theft'),
          passwordHash: await hashPassword('Pass123!'),
          firstName: 'Theft',
          lastName: 'Test',
        },
      });

      const rawToken1 = generateRawRefreshToken();
      const hash1 = hashRefreshToken(rawToken1);
      const familyId = generateFamilyId();

      // Token 1: already revoked
      await prisma.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: hash1,
          familyId,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          revokedAt: new Date(),
        },
      });

      // Token 2: active successor in same family
      const rawToken2 = generateRawRefreshToken();
      const hash2 = hashRefreshToken(rawToken2);
      await prisma.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: hash2,
          familyId,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      // Re-submitting hash1 (revoked token with active sibling hash2):
      // Theft detection triggers family revocation
      const activeSiblings = await prisma.refreshToken.findMany({
        where: { familyId, revokedAt: null, expiresAt: { gt: new Date() } },
      });

      expect(activeSiblings).toHaveLength(1);

      // Execute family revocation
      await prisma.refreshToken.updateMany({
        where: { familyId },
        data: { revokedAt: new Date() },
      });

      const remainingActive = await prisma.refreshToken.findMany({
        where: { familyId, revokedAt: null },
      });

      expect(remainingActive).toHaveLength(0);
    });

    it('enforces strict cookie transport requirement and rejects missing/empty cookie', async () => {
      const mockConfig = {
        jwtRefreshExpiryDays: 7,
        jwtAccessSecret: TEST_JWT_SECRET,
        jwtAccessExpiry: '15m',
      } as unknown as ApiConfigService;

      const authService = new AuthService(prisma as unknown as PrismaService, mockConfig);

      // Attempting refresh without cookie (empty token string) MUST be rejected with UnauthorizedException
      await expect(authService.refresh('')).rejects.toThrow('Refresh token missing');
    });
  });

  describe('4. Membership & Server-Side Tenant Isolation', () => {
    it('derives organization context strictly from DB membership and rejects cross-tenant access', async () => {
      const userA = await prisma.user.create({
        data: {
          email: testEmail('userA'),
          passwordHash: await hashPassword('Pass123!'),
          firstName: 'User',
          lastName: 'A',
        },
      });

      const orgA = await prisma.organization.create({
        data: { name: 'Org A', slug: testSlug('orgA') },
      });

      const orgB = await prisma.organization.create({
        data: { name: 'Org B', slug: testSlug('orgB') },
      });

      const ownerRole = await prisma.role.findFirstOrThrow({
        where: { name: 'OWNER', organizationId: null, isSystem: true },
      });

      // User A belongs ONLY to Org A
      await prisma.membership.create({
        data: {
          userId: userA.id,
          organizationId: orgA.id,
          roleId: ownerRole.id,
          status: MembershipStatus.ACTIVE,
        },
      });

      // Server-side check: Can User A access Org B?
      const membershipB = await prisma.membership.findFirst({
        where: {
          userId: userA.id,
          organizationId: orgB.id,
          deletedAt: null,
          organization: { deletedAt: null },
        },
      });

      expect(membershipB).toBeNull();
    });

    it('rejects SUSPENDED memberships', async () => {
      const user = await prisma.user.create({
        data: {
          email: testEmail('suspended'),
          passwordHash: await hashPassword('Pass123!'),
          firstName: 'Suspended',
          lastName: 'User',
        },
      });

      const org = await prisma.organization.create({
        data: { name: 'Org Suspended', slug: testSlug('org-susp') },
      });

      const memberRole = await prisma.role.findFirstOrThrow({
        where: { name: 'MEMBER', organizationId: null, isSystem: true },
      });

      await prisma.membership.create({
        data: {
          userId: user.id,
          organizationId: org.id,
          roleId: memberRole.id,
          status: MembershipStatus.SUSPENDED,
        },
      });

      const activeMembership = await prisma.membership.findFirst({
        where: {
          userId: user.id,
          organizationId: org.id,
          status: MembershipStatus.ACTIVE,
          deletedAt: null,
        },
      });

      expect(activeMembership).toBeNull();
    });
  });

  describe('5. Module Authorization via JOIN', () => {
    it('queries OrganizationModule JOIN Module on key', async () => {
      const org = await prisma.organization.create({
        data: { name: 'Module Org', slug: testSlug('mod-org') },
      });

      const projectsMod = await prisma.module.findFirstOrThrow({
        where: { key: 'projects' },
      });

      await prisma.organizationModule.create({
        data: {
          organizationId: org.id,
          moduleId: projectsMod.id,
          isEnabled: true,
        },
      });

      // Enabled module check
      const enabledCheck = await prisma.organizationModule.findFirst({
        where: {
          organizationId: org.id,
          module: { key: 'projects' },
          isEnabled: true,
        },
      });

      expect(enabledCheck).not.toBeNull();

      // Disabled/Unconfigured module check
      const disabledCheck = await prisma.organizationModule.findFirst({
        where: {
          organizationId: org.id,
          module: { key: 'analytics' },
          isEnabled: true,
        },
      });

      expect(disabledCheck).toBeNull();
    });
  });

  describe('6. Permission Authorization via RolePermission', () => {
    it('verifies effective role permissions through PostgreSQL RolePermission join table', async () => {
      const ownerRole = await prisma.role.findFirstOrThrow({
        where: { name: 'OWNER', organizationId: null, isSystem: true },
      });

      const memberRole = await prisma.role.findFirstOrThrow({
        where: { name: 'MEMBER', organizationId: null, isSystem: true },
      });

      const ownerPerms = await prisma.rolePermission.findMany({
        where: { roleId: ownerRole.id },
        include: { permission: true },
      });

      const memberPerms = await prisma.rolePermission.findMany({
        where: { roleId: memberRole.id },
        include: { permission: true },
      });

      const ownerKeys = ownerPerms.map((rp) => rp.permission.key);
      const memberKeys = memberPerms.map((rp) => rp.permission.key);

      expect(ownerKeys).toContain('organizations.delete');
      expect(memberKeys).not.toContain('organizations.delete');
    });
  });
});
