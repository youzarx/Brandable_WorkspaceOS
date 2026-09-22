import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient, MembershipStatus } from '@platform/database';
import { OrganizationService } from '../modules/organization/organization.service.js';
import { MemberService } from '../modules/member/member.service.js';
import { hashPassword } from '@platform/auth';
import type { PrismaService } from '../database/prisma.service.js';

if (!process.env['DATABASE_URL']) {
  process.env['DATABASE_URL'] = 'postgresql://platform:platform@127.0.0.1:5432/platform_dev';
}

const prisma = new PrismaClient();

beforeAll(async () => {
  try {
    await prisma.$connect();
  } catch {
    // Database connection tested gracefully in vitest
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});

function testEmail(suffix: string): string {
  return `org-sec-${suffix}-${Date.now()}-${Math.floor(Math.random() * 10000)}@example.com`;
}

function testSlug(suffix: string): string {
  return `org-sec-slug-${suffix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

describe('Phase 9 Security Invariants & Ownership Privilege Escalation Protection', () => {
  let orgService: OrganizationService;
  let memberService: MemberService;

  beforeAll(() => {
    orgService = new OrganizationService(prisma as unknown as PrismaService);
    memberService = new MemberService(prisma as unknown as PrismaService);
  });

  describe('1. Organization Management & Tenant Isolation', () => {
    it('should read current organization details', async () => {
      const slug = testSlug('read');
      const org = await prisma.organization.create({
        data: { name: 'Read Org', slug },
      });

      const result = await orgService.getOrganization(org.id);
      expect(result.id).toBe(org.id);
      expect(result.name).toBe('Read Org');
      expect(result.slug).toBe(slug);
    });

    it('should update organization name and branding fields', async () => {
      const slug = testSlug('update');
      const org = await prisma.organization.create({
        data: { name: 'Original Org Name', slug },
      });

      const owner = await prisma.user.create({
        data: {
          email: testEmail('owner1'),
          passwordHash: await hashPassword('Pass123!'),
          firstName: 'Owner',
          lastName: 'User',
        },
      });

      const updated = await orgService.updateOrganization(org.id, owner.id, {
        name: 'Updated Org Name',
        primaryColor: '#10b981',
        secondaryColor: '#3b82f6',
      });

      expect(updated.name).toBe('Updated Org Name');
      expect(updated.primaryColor).toBe('#10b981');
      expect(updated.secondaryColor).toBe('#3b82f6');
    });

    it('should enforce slug uniqueness when updating organization slug', async () => {
      const slugA = testSlug('unique-a');
      const slugB = testSlug('unique-b');

      await prisma.organization.create({
        data: { name: 'Org A', slug: slugA },
      });
      const orgB = await prisma.organization.create({
        data: { name: 'Org B', slug: slugB },
      });

      const owner = await prisma.user.create({
        data: {
          email: testEmail('owner-slug-check'),
          passwordHash: await hashPassword('Pass123!'),
          firstName: 'Owner',
          lastName: 'User',
        },
      });

      await expect(
        orgService.updateOrganization(orgB.id, owner.id, { slug: slugA }),
      ).rejects.toThrow('Organization slug is already in use');
    });
  });

  describe('2. Ownership Escalation Protection — Role Change', () => {
    it('should reject ADMIN attempting to change own role to OWNER', async () => {
      const slug = testSlug('admin-self-escalate');
      const org = await prisma.organization.create({
        data: { name: 'Admin Self Escalate Org', slug },
      });

      const ownerRole = await prisma.role.findFirst({
        where: { name: 'OWNER', organizationId: null },
      });
      const adminRole = await prisma.role.findFirst({
        where: { name: 'ADMIN', organizationId: null },
      });
      expect(ownerRole).toBeDefined();
      expect(adminRole).toBeDefined();

      if (ownerRole && adminRole) {
        // Create initial owner
        const realOwner = await prisma.user.create({
          data: {
            email: testEmail('real-owner'),
            passwordHash: await hashPassword('Pass123!'),
            firstName: 'Real',
            lastName: 'Owner',
          },
        });
        await prisma.membership.create({
          data: {
            userId: realOwner.id,
            organizationId: org.id,
            roleId: ownerRole.id,
            status: MembershipStatus.ACTIVE,
          },
        });

        // Create admin user
        const adminUser = await prisma.user.create({
          data: {
            email: testEmail('admin-self'),
            passwordHash: await hashPassword('Pass123!'),
            firstName: 'Admin',
            lastName: 'User',
          },
        });
        const adminMembership = await prisma.membership.create({
          data: {
            userId: adminUser.id,
            organizationId: org.id,
            roleId: adminRole.id,
            status: MembershipStatus.ACTIVE,
          },
        });

        // ADMIN attempts to change own role to OWNER -> 403 Forbidden
        await expect(
          memberService.updateMemberRole(org.id, adminMembership.id, adminUser.id, {
            roleId: ownerRole.id,
          }),
        ).rejects.toThrow('Only an active OWNER can assign the OWNER role');
      }
    });

    it('should reject ADMIN attempting to change another member role to OWNER', async () => {
      const slug = testSlug('admin-other-escalate');
      const org = await prisma.organization.create({
        data: { name: 'Admin Other Escalate Org', slug },
      });

      const ownerRole = await prisma.role.findFirst({
        where: { name: 'OWNER', organizationId: null },
      });
      const adminRole = await prisma.role.findFirst({
        where: { name: 'ADMIN', organizationId: null },
      });
      const memberRole = await prisma.role.findFirst({
        where: { name: 'MEMBER', organizationId: null },
      });
      expect(ownerRole).toBeDefined();
      expect(adminRole).toBeDefined();
      expect(memberRole).toBeDefined();

      if (ownerRole && adminRole && memberRole) {
        // Create owner & admin
        const realOwner = await prisma.user.create({
          data: {
            email: testEmail('real-owner-2'),
            passwordHash: await hashPassword('Pass123!'),
            firstName: 'Real',
            lastName: 'Owner',
          },
        });
        await prisma.membership.create({
          data: {
            userId: realOwner.id,
            organizationId: org.id,
            roleId: ownerRole.id,
            status: MembershipStatus.ACTIVE,
          },
        });

        const adminUser = await prisma.user.create({
          data: {
            email: testEmail('admin-actor'),
            passwordHash: await hashPassword('Pass123!'),
            firstName: 'Admin',
            lastName: 'Actor',
          },
        });
        await prisma.membership.create({
          data: {
            userId: adminUser.id,
            organizationId: org.id,
            roleId: adminRole.id,
            status: MembershipStatus.ACTIVE,
          },
        });

        const normalUser = await prisma.user.create({
          data: {
            email: testEmail('normal-target'),
            passwordHash: await hashPassword('Pass123!'),
            firstName: 'Normal',
            lastName: 'Target',
          },
        });
        const normalMembership = await prisma.membership.create({
          data: {
            userId: normalUser.id,
            organizationId: org.id,
            roleId: memberRole.id,
            status: MembershipStatus.ACTIVE,
          },
        });

        // ADMIN attempts to elevate normalUser to OWNER -> 403 Forbidden
        await expect(
          memberService.updateMemberRole(org.id, normalMembership.id, adminUser.id, {
            roleId: ownerRole.id,
          }),
        ).rejects.toThrow('Only an active OWNER can assign the OWNER role');
      }
    });

    it('should reject MEMBER attempting to change role to OWNER', async () => {
      const slug = testSlug('member-escalate');
      const org = await prisma.organization.create({
        data: { name: 'Member Escalate Org', slug },
      });

      const ownerRole = await prisma.role.findFirst({
        where: { name: 'OWNER', organizationId: null },
      });
      const memberRole = await prisma.role.findFirst({
        where: { name: 'MEMBER', organizationId: null },
      });
      expect(ownerRole).toBeDefined();
      expect(memberRole).toBeDefined();

      if (ownerRole && memberRole) {
        const owner = await prisma.user.create({
          data: {
            email: testEmail('owner-m'),
            passwordHash: await hashPassword('Pass123!'),
            firstName: 'Owner',
            lastName: 'M',
          },
        });
        await prisma.membership.create({
          data: {
            userId: owner.id,
            organizationId: org.id,
            roleId: ownerRole.id,
            status: MembershipStatus.ACTIVE,
          },
        });

        const memberUser = await prisma.user.create({
          data: {
            email: testEmail('member-actor'),
            passwordHash: await hashPassword('Pass123!'),
            firstName: 'Member',
            lastName: 'Actor',
          },
        });
        const memberMembership = await prisma.membership.create({
          data: {
            userId: memberUser.id,
            organizationId: org.id,
            roleId: memberRole.id,
            status: MembershipStatus.ACTIVE,
          },
        });

        await expect(
          memberService.updateMemberRole(org.id, memberMembership.id, memberUser.id, {
            roleId: ownerRole.id,
          }),
        ).rejects.toThrow('Only an active OWNER can assign the OWNER role');
      }
    });

    it('should allow OWNER to assign OWNER role to another member when multiple owners exist', async () => {
      const slug = testSlug('owner-assign-owner');
      const org = await prisma.organization.create({
        data: { name: 'Owner Assign Owner Org', slug },
      });

      const ownerRole = await prisma.role.findFirst({
        where: { name: 'OWNER', organizationId: null },
      });
      const memberRole = await prisma.role.findFirst({
        where: { name: 'MEMBER', organizationId: null },
      });
      expect(ownerRole).toBeDefined();
      expect(memberRole).toBeDefined();

      if (ownerRole && memberRole) {
        const ownerUser = await prisma.user.create({
          data: {
            email: testEmail('owner-actor-1'),
            passwordHash: await hashPassword('Pass123!'),
            firstName: 'Owner',
            lastName: 'One',
          },
        });
        await prisma.membership.create({
          data: {
            userId: ownerUser.id,
            organizationId: org.id,
            roleId: ownerRole.id,
            status: MembershipStatus.ACTIVE,
          },
        });

        const targetUser = await prisma.user.create({
          data: {
            email: testEmail('target-to-owner'),
            passwordHash: await hashPassword('Pass123!'),
            firstName: 'Target',
            lastName: 'Member',
          },
        });
        const targetMembership = await prisma.membership.create({
          data: {
            userId: targetUser.id,
            organizationId: org.id,
            roleId: memberRole.id,
            status: MembershipStatus.ACTIVE,
          },
        });

        const updated = (await memberService.updateMemberRole(
          org.id,
          targetMembership.id,
          ownerUser.id,
          { roleId: ownerRole.id },
        )) as { role: { name: string } };
        expect(updated.role.name).toBe('OWNER');
      }
    });
  });

  describe('3. Ownership Escalation Protection — Member Invitation', () => {
    it('should reject ADMIN inviting member with OWNER role', async () => {
      const slug = testSlug('admin-invite-owner');
      const org = await prisma.organization.create({
        data: { name: 'Admin Invite Owner Org', slug },
      });

      const ownerRole = await prisma.role.findFirst({
        where: { name: 'OWNER', organizationId: null },
      });
      const adminRole = await prisma.role.findFirst({
        where: { name: 'ADMIN', organizationId: null },
      });
      expect(ownerRole).toBeDefined();
      expect(adminRole).toBeDefined();

      if (ownerRole && adminRole) {
        const realOwner = await prisma.user.create({
          data: {
            email: testEmail('real-owner-inv'),
            passwordHash: await hashPassword('Pass123!'),
            firstName: 'Owner',
            lastName: 'User',
          },
        });
        await prisma.membership.create({
          data: {
            userId: realOwner.id,
            organizationId: org.id,
            roleId: ownerRole.id,
            status: MembershipStatus.ACTIVE,
          },
        });

        const adminUser = await prisma.user.create({
          data: {
            email: testEmail('admin-inviter'),
            passwordHash: await hashPassword('Pass123!'),
            firstName: 'Admin',
            lastName: 'User',
          },
        });
        await prisma.membership.create({
          data: {
            userId: adminUser.id,
            organizationId: org.id,
            roleId: adminRole.id,
            status: MembershipStatus.ACTIVE,
          },
        });

        await expect(
          memberService.inviteMember(org.id, adminUser.id, {
            email: testEmail('new-owner-invitee'),
            roleId: ownerRole.id,
          }),
        ).rejects.toThrow('Only an active OWNER can assign the OWNER role');
      }
    });

    it('should allow OWNER to invite a member with OWNER role', async () => {
      const slug = testSlug('owner-invite-owner');
      const org = await prisma.organization.create({
        data: { name: 'Owner Invite Owner Org', slug },
      });

      const ownerRole = await prisma.role.findFirst({
        where: { name: 'OWNER', organizationId: null },
      });
      expect(ownerRole).toBeDefined();

      if (ownerRole) {
        const ownerUser = await prisma.user.create({
          data: {
            email: testEmail('owner-inviter'),
            passwordHash: await hashPassword('Pass123!'),
            firstName: 'Owner',
            lastName: 'User',
          },
        });
        await prisma.membership.create({
          data: {
            userId: ownerUser.id,
            organizationId: org.id,
            roleId: ownerRole.id,
            status: MembershipStatus.ACTIVE,
          },
        });

        const inviteeEmail = testEmail('invited-new-owner');
        const invited = (await memberService.inviteMember(org.id, ownerUser.id, {
          email: inviteeEmail,
          roleId: ownerRole.id,
        })) as { role: { name: string }; status: string };

        expect(invited.role.name).toBe('OWNER');
        expect(invited.status).toBe(MembershipStatus.PENDING);
      }
    });
  });

  describe('4. Ownership Escalation Protection — Member Removal', () => {
    it('should reject ADMIN attempting to remove an OWNER', async () => {
      const slug = testSlug('admin-rem-owner');
      const org = await prisma.organization.create({
        data: { name: 'Admin Remove Owner Org', slug },
      });

      const ownerRole = await prisma.role.findFirst({
        where: { name: 'OWNER', organizationId: null },
      });
      const adminRole = await prisma.role.findFirst({
        where: { name: 'ADMIN', organizationId: null },
      });
      expect(ownerRole).toBeDefined();
      expect(adminRole).toBeDefined();

      if (ownerRole && adminRole) {
        const ownerUser = await prisma.user.create({
          data: {
            email: testEmail('owner-to-remove'),
            passwordHash: await hashPassword('Pass123!'),
            firstName: 'Owner',
            lastName: 'Target',
          },
        });
        const ownerMembership = await prisma.membership.create({
          data: {
            userId: ownerUser.id,
            organizationId: org.id,
            roleId: ownerRole.id,
            status: MembershipStatus.ACTIVE,
          },
        });

        const adminUser = await prisma.user.create({
          data: {
            email: testEmail('admin-remover'),
            passwordHash: await hashPassword('Pass123!'),
            firstName: 'Admin',
            lastName: 'User',
          },
        });
        await prisma.membership.create({
          data: {
            userId: adminUser.id,
            organizationId: org.id,
            roleId: adminRole.id,
            status: MembershipStatus.ACTIVE,
          },
        });

        await expect(
          memberService.removeMember(org.id, ownerMembership.id, adminUser.id),
        ).rejects.toThrow('Only an active OWNER can remove an OWNER membership');
      }
    });

    it('should reject OWNER removing sole OWNER', async () => {
      const slug = testSlug('sole-owner-rem-self');
      const org = await prisma.organization.create({
        data: { name: 'Sole Owner Remove Self Org', slug },
      });

      const ownerRole = await prisma.role.findFirst({
        where: { name: 'OWNER', organizationId: null },
      });
      expect(ownerRole).toBeDefined();

      if (ownerRole) {
        const soleOwner = await prisma.user.create({
          data: {
            email: testEmail('sole-owner-actor'),
            passwordHash: await hashPassword('Pass123!'),
            firstName: 'Sole',
            lastName: 'Owner',
          },
        });
        const soleMembership = await prisma.membership.create({
          data: {
            userId: soleOwner.id,
            organizationId: org.id,
            roleId: ownerRole.id,
            status: MembershipStatus.ACTIVE,
          },
        });

        await expect(
          memberService.removeMember(org.id, soleMembership.id, soleOwner.id),
        ).rejects.toThrow('Cannot remove the sole OWNER of the organization');
      }
    });

    it('should allow OWNER to remove another OWNER when multiple owners exist', async () => {
      const slug = testSlug('owner-rem-owner');
      const org = await prisma.organization.create({
        data: { name: 'Owner Remove Owner Org', slug },
      });

      const ownerRole = await prisma.role.findFirst({
        where: { name: 'OWNER', organizationId: null },
      });
      expect(ownerRole).toBeDefined();

      if (ownerRole) {
        const owner1 = await prisma.user.create({
          data: {
            email: testEmail('owner-actor-rem'),
            passwordHash: await hashPassword('Pass123!'),
            firstName: 'Owner',
            lastName: 'One',
          },
        });
        await prisma.membership.create({
          data: {
            userId: owner1.id,
            organizationId: org.id,
            roleId: ownerRole.id,
            status: MembershipStatus.ACTIVE,
          },
        });

        const owner2 = await prisma.user.create({
          data: {
            email: testEmail('owner-target-rem'),
            passwordHash: await hashPassword('Pass123!'),
            firstName: 'Owner',
            lastName: 'Two',
          },
        });
        const owner2Membership = await prisma.membership.create({
          data: {
            userId: owner2.id,
            organizationId: org.id,
            roleId: ownerRole.id,
            status: MembershipStatus.ACTIVE,
          },
        });

        const result = await memberService.removeMember(org.id, owner2Membership.id, owner1.id);
        expect(result.message).toBe('Member removed successfully');

        const checkMem = await prisma.membership.findUnique({ where: { id: owner2Membership.id } });
        expect(checkMem?.status).toBe(MembershipStatus.SUSPENDED);
        expect(checkMem?.deletedAt).not.toBeNull();

        // Check user identity remains intact
        const checkUser = await prisma.user.findUnique({ where: { id: owner2.id } });
        expect(checkUser).not.toBeNull();
      }
    });
  });

  describe('5. Normal ADMIN & Cross-Tenant Safety Invariants', () => {
    it('should allow ADMIN to manage non-OWNER members (e.g. change MEMBER to ADMIN)', async () => {
      const slug = testSlug('admin-manage-member');
      const org = await prisma.organization.create({
        data: { name: 'Admin Manage Member Org', slug },
      });

      const ownerRole = await prisma.role.findFirst({
        where: { name: 'OWNER', organizationId: null },
      });
      const adminRole = await prisma.role.findFirst({
        where: { name: 'ADMIN', organizationId: null },
      });
      const memberRole = await prisma.role.findFirst({
        where: { name: 'MEMBER', organizationId: null },
      });
      expect(ownerRole).toBeDefined();
      expect(adminRole).toBeDefined();
      expect(memberRole).toBeDefined();

      if (ownerRole && adminRole && memberRole) {
        const owner = await prisma.user.create({
          data: {
            email: testEmail('owner-normal'),
            passwordHash: await hashPassword('Pass123!'),
            firstName: 'Owner',
            lastName: 'User',
          },
        });
        await prisma.membership.create({
          data: {
            userId: owner.id,
            organizationId: org.id,
            roleId: ownerRole.id,
            status: MembershipStatus.ACTIVE,
          },
        });

        const adminUser = await prisma.user.create({
          data: {
            email: testEmail('admin-normal'),
            passwordHash: await hashPassword('Pass123!'),
            firstName: 'Admin',
            lastName: 'User',
          },
        });
        await prisma.membership.create({
          data: {
            userId: adminUser.id,
            organizationId: org.id,
            roleId: adminRole.id,
            status: MembershipStatus.ACTIVE,
          },
        });

        const memberUser = await prisma.user.create({
          data: {
            email: testEmail('member-normal'),
            passwordHash: await hashPassword('Pass123!'),
            firstName: 'Member',
            lastName: 'User',
          },
        });
        const memberMembership = await prisma.membership.create({
          data: {
            userId: memberUser.id,
            organizationId: org.id,
            roleId: memberRole.id,
            status: MembershipStatus.ACTIVE,
          },
        });

        // ADMIN promotes MEMBER to ADMIN -> Success!
        const updated = (await memberService.updateMemberRole(
          org.id,
          memberMembership.id,
          adminUser.id,
          { roleId: adminRole.id },
        )) as { role: { name: string } };
        expect(updated.role.name).toBe('ADMIN');

        // ADMIN removes member -> Success!
        const res = await memberService.removeMember(org.id, memberMembership.id, adminUser.id);
        expect(res.message).toBe('Member removed successfully');
      }
    });

    it('should reject cross-tenant member modifications', async () => {
      const slugA = testSlug('cross-tenant-a');
      const slugB = testSlug('cross-tenant-b');

      const orgA = await prisma.organization.create({ data: { name: 'Org A', slug: slugA } });
      const orgB = await prisma.organization.create({ data: { name: 'Org B', slug: slugB } });

      const ownerRole = await prisma.role.findFirst({
        where: { name: 'OWNER', organizationId: null },
      });
      expect(ownerRole).toBeDefined();

      if (ownerRole) {
        const ownerA = await prisma.user.create({
          data: {
            email: testEmail('owner-a-cross'),
            passwordHash: await hashPassword('Pass123!'),
            firstName: 'Owner',
            lastName: 'A',
          },
        });
        await prisma.membership.create({
          data: {
            userId: ownerA.id,
            organizationId: orgA.id,
            roleId: ownerRole.id,
            status: MembershipStatus.ACTIVE,
          },
        });

        const ownerB = await prisma.user.create({
          data: {
            email: testEmail('owner-b-cross'),
            passwordHash: await hashPassword('Pass123!'),
            firstName: 'Owner',
            lastName: 'B',
          },
        });
        const membershipB = await prisma.membership.create({
          data: {
            userId: ownerB.id,
            organizationId: orgB.id,
            roleId: ownerRole.id,
            status: MembershipStatus.ACTIVE,
          },
        });

        // Owner A attempts to modify Org B's member -> 404 / 403 NotFoundException
        await expect(
          memberService.removeMember(orgA.id, membershipB.id, ownerA.id),
        ).rejects.toThrow('Member not found in organization');
      }
    });
  });
});
