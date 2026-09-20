/**
 * Database Integration Tests — Platform Foundation
 * ==================================================
 *
 * These tests verify the database schema constraints, indexes, and relationships
 * required by the approved architecture.
 *
 * REQUIREMENTS:
 *   - Live PostgreSQL instance (docker compose up -d postgres)
 *   - DATABASE_URL set to a test database
 *   - Migrations applied (pnpm db:migrate:dev)
 *   - Seed applied (pnpm db:seed)
 *
 * These tests use the real database to verify constraints at the PostgreSQL level.
 * They do NOT mock the database.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient, MembershipStatus } from '@prisma/client';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generate a unique email for test isolation */
function testEmail(suffix: string): string {
  return `test-${suffix}-${Date.now()}@example.com`;
}

/** Generate a unique slug for test isolation */
function testSlug(suffix: string): string {
  return `test-${suffix}-${Date.now()}`;
}

/** Create a test user */
async function createUser(email?: string) {
  return prisma.user.create({
    data: {
      email: email ?? testEmail('user'),
      passwordHash: '$2b$12$placeholder-hash-for-testing-only',
      firstName: 'Test',
      lastName: 'User',
    },
  });
}

/** Create a test organization */
async function createOrg(slug?: string) {
  return prisma.organization.create({
    data: {
      name: `Test Org ${Date.now()}`,
      slug: slug ?? testSlug('org'),
    },
  });
}

/** Get the MEMBER system role (seeded) */
async function getMemberRole() {
  const role = await prisma.role.findFirst({
    where: { name: 'MEMBER', organizationId: null, isSystem: true },
  });
  if (!role) throw new Error('MEMBER system role not found — run seed first');
  return role;
}

/** Get the OWNER system role (seeded) */
async function getOwnerRole() {
  const role = await prisma.role.findFirst({
    where: { name: 'OWNER', organizationId: null, isSystem: true },
  });
  if (!role) throw new Error('OWNER system role not found — run seed first');
  return role;
}

beforeAll(async () => {
  if (!process.env['DATABASE_URL']) {
    process.env['DATABASE_URL'] = 'postgresql://platform:platform@localhost:5432/platform_dev';
  }
  // Connect directly — will throw and fail test suite if DB is offline (Item 7 mandate)
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
});

// ---------------------------------------------------------------------------
// A. Tenant Isolation Foundation
// ---------------------------------------------------------------------------

describe('A. Tenant Isolation Foundation', () => {
  it('should enforce Membership UNIQUE(userId, organizationId)', async () => {
    const user = await createUser();
    const org = await createOrg();
    const role = await getMemberRole();

    await prisma.membership.create({
      data: {
        userId: user.id,
        organizationId: org.id,
        roleId: role.id,
        status: MembershipStatus.ACTIVE,
      },
    });

    // Attempting to create a duplicate membership should fail
    await expect(
      prisma.membership.create({
        data: {
          userId: user.id,
          organizationId: org.id,
          roleId: role.id,
          status: MembershipStatus.ACTIVE,
        },
      }),
    ).rejects.toThrow();
  });

  it('should enforce OrganizationModule UNIQUE(organizationId, moduleId)', async () => {
    const org = await createOrg();
    const mod = await prisma.module.findFirst({ where: { key: 'projects' } });
    if (!mod) throw new Error('projects module not found — run seed first');

    await prisma.organizationModule.create({
      data: {
        organizationId: org.id,
        moduleId: mod.id,
        isEnabled: true,
      },
    });

    // Attempting to create a duplicate org-module should fail
    await expect(
      prisma.organizationModule.create({
        data: {
          organizationId: org.id,
          moduleId: mod.id,
          isEnabled: false,
        },
      }),
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// B. Identity Lifecycle
// ---------------------------------------------------------------------------

describe('B. Identity Lifecycle', () => {
  it('should reject duplicate email', async () => {
    const email = testEmail('dup');
    await createUser(email);

    await expect(createUser(email)).rejects.toThrow();
  });

  it('should reject duplicate organization slug', async () => {
    const slug = testSlug('dup');
    await createOrg(slug);

    await expect(createOrg(slug)).rejects.toThrow();
  });

  it('should reject duplicate membership', async () => {
    const user = await createUser();
    const org = await createOrg();
    const role = await getMemberRole();

    await prisma.membership.create({
      data: {
        userId: user.id,
        organizationId: org.id,
        roleId: role.id,
        status: MembershipStatus.ACTIVE,
      },
    });

    await expect(
      prisma.membership.create({
        data: {
          userId: user.id,
          organizationId: org.id,
          roleId: role.id,
          status: MembershipStatus.PENDING,
        },
      }),
    ).rejects.toThrow();
  });

  it('should keep soft-deleted email reserved (cannot create new user with same email)', async () => {
    const email = testEmail('softdel');
    const user = await createUser(email);

    // Soft-delete the user
    await prisma.user.update({
      where: { id: user.id },
      data: { deletedAt: new Date() },
    });

    // Attempting to create a new user with the same email should fail
    await expect(createUser(email)).rejects.toThrow();
  });

  it('should keep soft-deleted slug reserved (cannot create new org with same slug)', async () => {
    const slug = testSlug('softdel');
    const org = await createOrg(slug);

    // Soft-delete the organization
    await prisma.organization.update({
      where: { id: org.id },
      data: { deletedAt: new Date() },
    });

    // Attempting to create a new organization with the same slug should fail
    await expect(createOrg(slug)).rejects.toThrow();
  });

  it('should allow membership reactivation without creating duplicate', async () => {
    const user = await createUser();
    const org = await createOrg();
    const role = await getMemberRole();

    // Create membership
    const membership = await prisma.membership.create({
      data: {
        userId: user.id,
        organizationId: org.id,
        roleId: role.id,
        status: MembershipStatus.ACTIVE,
      },
    });

    // Soft-delete (remove member)
    await prisma.membership.update({
      where: { id: membership.id },
      data: {
        deletedAt: new Date(),
        status: MembershipStatus.SUSPENDED,
      },
    });

    // Cannot create a new membership — unique constraint still holds
    await expect(
      prisma.membership.create({
        data: {
          userId: user.id,
          organizationId: org.id,
          roleId: role.id,
          status: MembershipStatus.PENDING,
        },
      }),
    ).rejects.toThrow();

    // Reactivation: update the existing record
    const reactivated = await prisma.membership.update({
      where: { id: membership.id },
      data: {
        deletedAt: null,
        status: MembershipStatus.PENDING,
        invitedAt: new Date(),
      },
    });

    expect(reactivated.id).toBe(membership.id);
    expect(reactivated.deletedAt).toBeNull();
    expect(reactivated.status).toBe(MembershipStatus.PENDING);
  });
});

// ---------------------------------------------------------------------------
// C. RBAC Foundation
// ---------------------------------------------------------------------------

describe('C. RBAC Foundation', () => {
  it('should enforce global role uniqueness (partial index: name WHERE orgId IS NULL)', async () => {
    // The seed has already created OWNER, ADMIN, MEMBER as system roles.
    // Attempting to create another system role with the same name should fail.
    await expect(
      prisma.role.create({
        data: {
          name: 'OWNER',
          isSystem: true,
          organizationId: null,
        },
      }),
    ).rejects.toThrow();
  });

  it('should enforce org role uniqueness (partial index: name+orgId WHERE orgId IS NOT NULL)', async () => {
    const org = await createOrg();

    await prisma.role.create({
      data: {
        name: 'Manager',
        organizationId: org.id,
        isSystem: false,
      },
    });

    // Duplicate name in the same org should fail
    await expect(
      prisma.role.create({
        data: {
          name: 'Manager',
          organizationId: org.id,
          isSystem: false,
        },
      }),
    ).rejects.toThrow();
  });

  it('should allow same role name across different organizations', async () => {
    const orgA = await createOrg();
    const orgB = await createOrg();

    const roleA = await prisma.role.create({
      data: {
        name: 'Supervisor',
        organizationId: orgA.id,
        isSystem: false,
      },
    });

    const roleB = await prisma.role.create({
      data: {
        name: 'Supervisor',
        organizationId: orgB.id,
        isSystem: false,
      },
    });

    expect(roleA.name).toBe(roleB.name);
    expect(roleA.organizationId).not.toBe(roleB.organizationId);
  });

  it('should enforce RolePermission composite uniqueness', async () => {
    const org = await createOrg();
    const role = await prisma.role.create({
      data: {
        name: 'TestRole',
        organizationId: org.id,
        isSystem: false,
      },
    });

    const permission = await prisma.permission.findFirst({
      where: { key: 'organizations.read' },
    });
    if (!permission) throw new Error('Permission not found — run seed first');

    await prisma.rolePermission.create({
      data: {
        roleId: role.id,
        permissionId: permission.id,
      },
    });

    // Duplicate assignment should fail
    await expect(
      prisma.rolePermission.create({
        data: {
          roleId: role.id,
          permissionId: permission.id,
        },
      }),
    ).rejects.toThrow();
  });

  it('should enforce Permission key uniqueness', async () => {
    // organizations.read already exists from seed
    await expect(
      prisma.permission.create({
        data: { key: 'organizations.read' },
      }),
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// D. Module Foundation
// ---------------------------------------------------------------------------

describe('D. Module Foundation', () => {
  it('should enforce Module key uniqueness', async () => {
    // 'projects' already exists from seed
    await expect(
      prisma.module.create({
        data: {
          key: 'projects',
          name: 'Duplicate Projects',
        },
      }),
    ).rejects.toThrow();
  });

  it('should enforce OrganizationModule UNIQUE(orgId, moduleId)', async () => {
    const org = await createOrg();
    const mod = await prisma.module.findFirst({ where: { key: 'tasks' } });
    if (!mod) throw new Error('tasks module not found — run seed first');

    await prisma.organizationModule.create({
      data: {
        organizationId: org.id,
        moduleId: mod.id,
        isEnabled: true,
      },
    });

    await expect(
      prisma.organizationModule.create({
        data: {
          organizationId: org.id,
          moduleId: mod.id,
          isEnabled: false,
        },
      }),
    ).rejects.toThrow();
  });

  it('should resolve module key through Module relation (no moduleKey on OrganizationModule)', async () => {
    const org = await createOrg();
    const mod = await prisma.module.findFirst({ where: { key: 'crm' } });
    if (!mod) throw new Error('crm module not found — run seed first');

    await prisma.organizationModule.create({
      data: {
        organizationId: org.id,
        moduleId: mod.id,
        isEnabled: true,
      },
    });

    // Query through the JOIN — the documented resolution path
    const result = await prisma.organizationModule.findFirst({
      where: {
        organizationId: org.id,
        isEnabled: true,
        module: {
          key: 'crm',
        },
      },
      include: { module: true },
    });

    expect(result).not.toBeNull();
    expect(result?.module.key).toBe('crm');

    // Verify: OrganizationModule does NOT have a moduleKey field
    const orgModule = await prisma.organizationModule.findFirst({
      where: { organizationId: org.id },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((orgModule as any)?.moduleKey).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// E. Refresh Token Foundation
// ---------------------------------------------------------------------------

describe('E. Refresh Token Foundation', () => {
  it('should enforce tokenHash uniqueness', async () => {
    const user = await createUser();
    const hash = `testhash-${Date.now()}`;

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hash,
        familyId: 'family-1',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    await expect(
      prisma.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: hash,
          familyId: 'family-2',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      }),
    ).rejects.toThrow();
  });

  it('should group tokens by familyId', async () => {
    const user = await createUser();
    const familyId = `family-${Date.now()}`;

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: `hash-a-${Date.now()}`,
        familyId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: `hash-b-${Date.now()}`,
        familyId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const familyTokens = await prisma.refreshToken.findMany({
      where: { familyId },
    });

    expect(familyTokens).toHaveLength(2);
    expect(familyTokens.every((t) => t.familyId === familyId)).toBe(true);
  });

  it('should support revokedAt for active/revoked states', async () => {
    const user = await createUser();

    const token = await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: `hash-revoke-${Date.now()}`,
        familyId: `family-revoke-${Date.now()}`,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    // Initially active (revokedAt is null)
    expect(token.revokedAt).toBeNull();

    // Revoke
    const revoked = await prisma.refreshToken.update({
      where: { id: token.id },
      data: { revokedAt: new Date() },
    });

    expect(revoked.revokedAt).not.toBeNull();

    // Query active tokens
    const activeTokens = await prisma.refreshToken.findMany({
      where: {
        userId: user.id,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    expect(activeTokens.find((t) => t.id === token.id)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// F. Audit Foundation
// ---------------------------------------------------------------------------

describe('F. Audit Foundation', () => {
  it('should create audit log entries', async () => {
    const org = await createOrg();
    const user = await createUser();

    const log = await prisma.auditLog.create({
      data: {
        organizationId: org.id,
        userId: user.id,
        action: 'membership.created',
        resource: 'Membership',
        resourceId: 'test-resource-id',
        metadata: { test: true },
      },
    });

    expect(log.id).toBeDefined();
    expect(log.createdAt).toBeDefined();
    // AuditLog has no updatedAt — it's append-only
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((log as any).updatedAt).toBeUndefined();
  });

  it('should support system-generated events (userId = null)', async () => {
    const org = await createOrg();

    const log = await prisma.auditLog.create({
      data: {
        organizationId: org.id,
        userId: null,
        action: 'system.maintenance',
        resource: 'System',
      },
    });

    expect(log.userId).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// G. Seed Verification
// ---------------------------------------------------------------------------

describe('G. Seed Data Verification', () => {
  it('should have seeded 17 permissions', async () => {
    const permissions = await prisma.permission.findMany();
    expect(permissions).toHaveLength(17);
  });

  it('should have seeded 3 system roles', async () => {
    const systemRoles = await prisma.role.findMany({
      where: { isSystem: true, organizationId: null },
    });
    expect(systemRoles).toHaveLength(3);

    const roleNames = systemRoles.map((r) => r.name).sort();
    expect(roleNames).toEqual(['ADMIN', 'MEMBER', 'OWNER']);
  });

  it('should have seeded 8 modules', async () => {
    const modules = await prisma.module.findMany();
    expect(modules).toHaveLength(8);

    const moduleKeys = modules.map((m) => m.key).sort();
    expect(moduleKeys).toEqual([
      'analytics',
      'calendar',
      'chat',
      'content',
      'crm',
      'invoices',
      'projects',
      'tasks',
    ]);
  });

  it('should have OWNER role with all permissions', async () => {
    const ownerRole = await getOwnerRole();
    const ownerPerms = await prisma.rolePermission.findMany({
      where: { roleId: ownerRole.id },
      include: { permission: true },
    });

    const totalPerms = await prisma.permission.count();
    expect(ownerPerms.length).toBe(totalPerms);
  });

  it('should have ADMIN role with all permissions except organizations.delete', async () => {
    const adminRole = await prisma.role.findFirst({
      where: { name: 'ADMIN', organizationId: null, isSystem: true },
    });
    if (!adminRole) throw new Error('ADMIN role not found');

    const adminPerms = await prisma.rolePermission.findMany({
      where: { roleId: adminRole.id },
      include: { permission: true },
    });

    const permKeys = adminPerms.map((rp) => rp.permission.key);
    expect(permKeys).not.toContain('organizations.delete');

    const totalPerms = await prisma.permission.count();
    expect(adminPerms.length).toBe(totalPerms - 1);
  });

  it('should have MEMBER role with read-only subset', async () => {
    const memberRole = await getMemberRole();
    const memberPerms = await prisma.rolePermission.findMany({
      where: { roleId: memberRole.id },
      include: { permission: true },
    });

    const permKeys = memberPerms.map((rp) => rp.permission.key);
    expect(permKeys).toContain('organizations.read');
    expect(permKeys).toContain('users.read');
    expect(permKeys).toContain('memberships.read');
    expect(permKeys).toContain('roles.read');
    expect(permKeys).toContain('permissions.read');
    expect(permKeys).toContain('modules.read');
    expect(permKeys).toContain('settings.read');

    // Should NOT have write permissions
    expect(permKeys).not.toContain('organizations.delete');
    expect(permKeys).not.toContain('users.invite');
    expect(permKeys).not.toContain('roles.manage');
  });
});

// ---------------------------------------------------------------------------
// H. Index Verification
// ---------------------------------------------------------------------------

describe('H. Index Verification', () => {
  it('should have required indexes (verified via Prisma introspection)', async () => {
    // We verify indexes exist by checking the information_schema
    const indexes = await prisma.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname FROM pg_indexes
      WHERE schemaname = 'public'
      ORDER BY indexname
    `;

    const indexNames = indexes.map((i) => i.indexname);

    // User indexes
    expect(indexNames.some((n) => n.includes('User') && n.includes('email'))).toBe(true);

    // Membership indexes
    expect(
      indexNames.some(
        (n) => n.includes('Membership') && n.includes('userId') && n.includes('organizationId'),
      ),
    ).toBe(true);

    // RefreshToken indexes
    expect(indexNames.some((n) => n.includes('RefreshToken') && n.includes('tokenHash'))).toBe(
      true,
    );
    expect(indexNames.some((n) => n.includes('RefreshToken') && n.includes('familyId'))).toBe(true);

    // Role partial indexes
    expect(indexNames).toContain('role_name_system_unique');
    expect(indexNames).toContain('role_name_org_unique');

    // Module indexes
    expect(indexNames.some((n) => n.includes('Module') && n.includes('key'))).toBe(true);
  });
});
