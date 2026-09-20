import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const shouldClean = process.argv.includes('--clean');

  if (shouldClean) {
    console.log('🧹 Truncating database tables...');
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "User", "Organization", "Membership", "Role", "Permission", "RolePermission", "Module", "OrganizationModule", "RefreshToken", "AuditLog" CASCADE;',
    );
    console.log('✅ Database truncated successfully.\n');
  }

  const userCount = await prisma.user.count();
  const orgCount = await prisma.organization.count();
  const membershipCount = await prisma.membership.count();
  const permissionCount = await prisma.permission.count();
  const systemRoleCount = await prisma.role.count({
    where: { isSystem: true, organizationId: null },
  });
  const moduleCount = await prisma.module.count();

  console.log('--- DATABASE RECORD COUNTS ---');
  console.log(`Users created by seed: ${userCount}`);
  console.log(`Organizations created by seed: ${orgCount}`);
  console.log(`Memberships created by seed: ${membershipCount}`);
  console.log(`Permissions: ${permissionCount}`);
  console.log(`System roles: ${systemRoleCount}`);
  console.log(`Modules: ${moduleCount}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error('Failed to verify counts:', err);
    await prisma.$disconnect();
    process.exit(1);
  });
