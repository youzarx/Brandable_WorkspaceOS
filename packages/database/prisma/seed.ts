/**
 * Database Seed — Platform Foundation
 * ====================================
 *
 * Seeds the foundation data required by the platform architecture.
 * This seed is IDEMPOTENT — running it multiple times will not create duplicates.
 *
 * Seeds:
 *   1. 17 Permissions (from docs/database.md)
 *   2. 3 System Roles: OWNER, ADMIN, MEMBER
 *   3. Role-Permission assignments
 *   4. 8 Modules: projects, tasks, invoices, crm, calendar, chat, content, analytics
 *
 * Does NOT seed:
 *   - Users, organizations, or memberships
 *   - Business data (projects, invoices, etc.)
 *   - Secrets or credentials
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Permission definitions (from docs/database.md)
// ---------------------------------------------------------------------------
const PERMISSIONS = [
  { key: 'organizations.read', description: 'View organization details' },
  { key: 'organizations.update', description: 'Update organization settings' },
  {
    key: 'organizations.delete',
    description: 'Delete (deactivate) an organization',
  },
  { key: 'users.read', description: 'View user profiles' },
  { key: 'users.update', description: 'Update user profiles' },
  { key: 'users.invite', description: 'Invite users to the organization' },
  {
    key: 'users.remove',
    description: 'Remove users from the organization',
  },
  { key: 'roles.read', description: 'View roles' },
  {
    key: 'roles.manage',
    description: 'Create, update, and delete organization roles',
  },
  { key: 'permissions.read', description: 'View available permissions' },
  { key: 'memberships.read', description: 'View organization memberships' },
  {
    key: 'memberships.manage',
    description: 'Manage membership status and roles',
  },
  { key: 'settings.read', description: 'View organization settings' },
  { key: 'settings.update', description: 'Update organization settings' },
  { key: 'modules.read', description: 'View enabled modules' },
  {
    key: 'modules.configure',
    description: 'Enable/disable modules for the organization',
  },
  { key: 'audit.read', description: 'View audit logs' },
] as const;

// ---------------------------------------------------------------------------
// Role definitions (system roles — organizationId = null)
// ---------------------------------------------------------------------------
// OWNER: all 17 permissions
// ADMIN: all except organizations.delete
// MEMBER: read-oriented subset
const ROLE_DEFINITIONS = {
  OWNER: {
    name: 'OWNER',
    description: 'Full access. Organization creator.',
    permissions: PERMISSIONS.map((p) => p.key),
  },
  ADMIN: {
    name: 'ADMIN',
    description: 'Administrative access. All permissions except organization deletion.',
    permissions: PERMISSIONS.filter((p) => p.key !== 'organizations.delete').map((p) => p.key),
  },
  MEMBER: {
    name: 'MEMBER',
    description: 'Standard member. Read-only access to most resources.',
    permissions: [
      'organizations.read',
      'users.read',
      'memberships.read',
      'roles.read',
      'permissions.read',
      'modules.read',
      'settings.read',
    ],
  },
} as const;

// ---------------------------------------------------------------------------
// Module definitions (from docs/database.md)
// ---------------------------------------------------------------------------
const MODULES = [
  {
    key: 'projects',
    name: 'Projects',
    description: 'Project management module',
  },
  { key: 'tasks', name: 'Tasks', description: 'Task management module' },
  {
    key: 'invoices',
    name: 'Invoices',
    description: 'Invoice and billing module',
  },
  {
    key: 'crm',
    name: 'CRM',
    description: 'Customer relationship management',
  },
  {
    key: 'calendar',
    name: 'Calendar',
    description: 'Calendar and scheduling module',
  },
  { key: 'chat', name: 'Chat', description: 'Real-time messaging module' },
  {
    key: 'content',
    name: 'Content',
    description: 'Content management module',
  },
  {
    key: 'analytics',
    name: 'Analytics',
    description: 'Analytics and reporting module',
  },
] as const;

// ---------------------------------------------------------------------------
// Seed execution
// ---------------------------------------------------------------------------
async function seed(): Promise<void> {
  console.log('🌱 Starting platform seed...\n');

  // 1. Seed Permissions
  console.log('  📋 Seeding permissions...');
  const permissionRecords: Record<string, string> = {};
  for (const perm of PERMISSIONS) {
    const record = await prisma.permission.upsert({
      where: { key: perm.key },
      update: { description: perm.description },
      create: { key: perm.key, description: perm.description },
    });
    permissionRecords[perm.key] = record.id;
  }
  console.log(`  ✅ ${PERMISSIONS.length} permissions seeded\n`);

  // 2. Seed System Roles + Role-Permission assignments
  console.log('  👤 Seeding system roles...');
  for (const [, roleDef] of Object.entries(ROLE_DEFINITIONS)) {
    // Upsert the role
    // We use a raw query to find by name where organizationId IS NULL
    // because Prisma @@unique doesn't support partial indexes
    const existingRole = await prisma.role.findFirst({
      where: { name: roleDef.name, organizationId: null },
    });

    let roleId: string;
    if (existingRole) {
      await prisma.role.update({
        where: { id: existingRole.id },
        data: { description: roleDef.description, isSystem: true },
      });
      roleId = existingRole.id;
    } else {
      const newRole = await prisma.role.create({
        data: {
          name: roleDef.name,
          description: roleDef.description,
          isSystem: true,
          organizationId: null,
        },
      });
      roleId = newRole.id;
    }

    // Sync role-permission assignments
    // Delete existing assignments and recreate
    await prisma.rolePermission.deleteMany({ where: { roleId } });

    const permissionAssignments = roleDef.permissions
      .map((key) => {
        const permId = permissionRecords[key];
        if (!permId) {
          console.warn(`  ⚠️  Permission "${key}" not found for role "${roleDef.name}"`);
          return null;
        }
        return { roleId, permissionId: permId };
      })
      .filter((a): a is { roleId: string; permissionId: string } => a !== null);

    if (permissionAssignments.length > 0) {
      await prisma.rolePermission.createMany({ data: permissionAssignments });
    }

    console.log(`  ✅ Role "${roleDef.name}" → ${permissionAssignments.length} permissions`);
  }
  console.log();

  // 3. Seed Modules
  console.log('  📦 Seeding modules...');
  for (const mod of MODULES) {
    await prisma.module.upsert({
      where: { key: mod.key },
      update: { name: mod.name, description: mod.description },
      create: { key: mod.key, name: mod.name, description: mod.description },
    });
  }
  console.log(`  ✅ ${MODULES.length} modules seeded\n`);

  console.log('🎉 Seed complete!\n');
}

seed()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e: unknown) => {
    console.error('❌ Seed failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
