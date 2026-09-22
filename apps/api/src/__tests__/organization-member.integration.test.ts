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
  return `org-member-test-${suffix}-${Date.now()}-${Math.floor(Math.random() * 10000)}@example.com`;
}

function testSlug(suffix: string): string {
  return `org-slug-${suffix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

describe('Phase 9 Organization & Member Management Integration Tests', () => {
  let orgService: OrganizationService;
  let memberService: MemberService;

  beforeAll(() => {
    orgService = new OrganizationService(prisma as unknown as PrismaService);
    memberService = new MemberService(prisma as unknown as PrismaService);
  });

  describe('1. Organization Management', () => {
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

  describe('2. Member Management & Safety Rules', () => {
    it('should list organization members and roles', async () => {
      const slug = testSlug('list-members');
      const org = await prisma.organization.create({
        data: { name: 'List Members Org', slug },
      });

      const ownerRole = await prisma.role.findFirst({
        where: { name: 'OWNER', organizationId: null },
      });
      expect(ownerRole).toBeDefined();

      const user = await prisma.user.create({
        data: {
          email: testEmail('user-list'),
          passwordHash: await hashPassword('Pass123!'),
          firstName: 'List',
          lastName: 'User',
        },
      });

      if (ownerRole) {
        await prisma.membership.create({
          data: {
            userId: user.id,
            organizationId: org.id,
            roleId: ownerRole.id,
            status: MembershipStatus.ACTIVE,
            joinedAt: new Date(),
          },
        });
      }

      const members = (await memberService.listMembers(org.id)) as Array<{
        user: { email: string };
        role: { name: string };
      }>;
      expect(members.length).toBe(1);
      expect(members[0]?.user.email).toBe(user.email);
      expect(members[0]?.role.name).toBe('OWNER');

      const roles = (await memberService.listRoles(org.id)) as Array<{ name: string }>;
      expect(roles.some((r) => r.name === 'OWNER')).toBe(true);
      expect(roles.some((r) => r.name === 'ADMIN')).toBe(true);
      expect(roles.some((r) => r.name === 'MEMBER')).toBe(true);
    });

    it('should invite a new user creating a pending membership', async () => {
      const slug = testSlug('invite-new');
      const org = await prisma.organization.create({
        data: { name: 'Invite Org', slug },
      });

      const memberRole = await prisma.role.findFirst({
        where: { name: 'MEMBER', organizationId: null },
      });
      expect(memberRole).toBeDefined();

      const inviter = await prisma.user.create({
        data: {
          email: testEmail('inviter'),
          passwordHash: await hashPassword('Pass123!'),
          firstName: 'Inviter',
          lastName: 'User',
        },
      });

      const inviteeEmail = testEmail('invitee');
      if (memberRole) {
        const invitedMember = (await memberService.inviteMember(org.id, inviter.id, {
          email: inviteeEmail,
          roleId: memberRole.id,
        })) as { status: string; user: { email: string }; role: { name: string } };

        expect(invitedMember.user.email).toBe(inviteeEmail);
        expect(invitedMember.status).toBe(MembershipStatus.PENDING);
        expect(invitedMember.role.name).toBe('MEMBER');
      }
    });

    it('should prevent changing role of sole OWNER of organization', async () => {
      const slug = testSlug('sole-owner-role');
      const org = await prisma.organization.create({
        data: { name: 'Sole Owner Org', slug },
      });

      const ownerRole = await prisma.role.findFirst({
        where: { name: 'OWNER', organizationId: null },
      });
      const memberRole = await prisma.role.findFirst({
        where: { name: 'MEMBER', organizationId: null },
      });
      expect(ownerRole).toBeDefined();
      expect(memberRole).toBeDefined();

      const owner = await prisma.user.create({
        data: {
          email: testEmail('sole-owner'),
          passwordHash: await hashPassword('Pass123!'),
          firstName: 'Sole',
          lastName: 'Owner',
        },
      });

      if (ownerRole && memberRole) {
        const membership = await prisma.membership.create({
          data: {
            userId: owner.id,
            organizationId: org.id,
            roleId: ownerRole.id,
            status: MembershipStatus.ACTIVE,
            joinedAt: new Date(),
          },
        });

        await expect(
          memberService.updateMemberRole(org.id, membership.id, owner.id, {
            roleId: memberRole.id,
          }),
        ).rejects.toThrow('Cannot change role of the sole OWNER of the organization');
      }
    });

    it('should prevent removing sole OWNER of organization', async () => {
      const slug = testSlug('sole-owner-remove');
      const org = await prisma.organization.create({
        data: { name: 'Sole Owner Remove Org', slug },
      });

      const ownerRole = await prisma.role.findFirst({
        where: { name: 'OWNER', organizationId: null },
      });
      expect(ownerRole).toBeDefined();

      const owner = await prisma.user.create({
        data: {
          email: testEmail('sole-owner-rem'),
          passwordHash: await hashPassword('Pass123!'),
          firstName: 'Sole',
          lastName: 'Owner',
        },
      });

      if (ownerRole) {
        const membership = await prisma.membership.create({
          data: {
            userId: owner.id,
            organizationId: org.id,
            roleId: ownerRole.id,
            status: MembershipStatus.ACTIVE,
            joinedAt: new Date(),
          },
        });

        await expect(memberService.removeMember(org.id, membership.id, owner.id)).rejects.toThrow(
          'Cannot remove the sole OWNER of the organization',
        );
      }
    });

    it('should soft-delete membership without deleting User record when member is removed', async () => {
      const slug = testSlug('soft-delete-member');
      const org = await prisma.organization.create({
        data: { name: 'Soft Delete Org', slug },
      });

      const ownerRole = await prisma.role.findFirst({
        where: { name: 'OWNER', organizationId: null },
      });
      const memberRole = await prisma.role.findFirst({
        where: { name: 'MEMBER', organizationId: null },
      });
      expect(ownerRole).toBeDefined();
      expect(memberRole).toBeDefined();

      const owner1 = await prisma.user.create({
        data: {
          email: testEmail('owner-a'),
          passwordHash: await hashPassword('Pass123!'),
          firstName: 'Owner',
          lastName: 'One',
        },
      });

      if (ownerRole && memberRole) {
        await prisma.membership.create({
          data: {
            userId: owner1.id,
            organizationId: org.id,
            roleId: ownerRole.id,
            status: MembershipStatus.ACTIVE,
            joinedAt: new Date(),
          },
        });

        const targetMemberUser = await prisma.user.create({
          data: {
            email: testEmail('member-target'),
            passwordHash: await hashPassword('Pass123!'),
            firstName: 'Target',
            lastName: 'Member',
          },
        });

        const targetMembership = await prisma.membership.create({
          data: {
            userId: targetMemberUser.id,
            organizationId: org.id,
            roleId: memberRole.id,
            status: MembershipStatus.ACTIVE,
            joinedAt: new Date(),
          },
        });

        // Remove member
        await memberService.removeMember(org.id, targetMembership.id, owner1.id);

        // Verify membership is soft-deleted
        const membershipCheck = await prisma.membership.findUnique({
          where: { id: targetMembership.id },
        });
        expect(membershipCheck?.deletedAt).not.toBeNull();
        expect(membershipCheck?.status).toBe(MembershipStatus.SUSPENDED);

        // CRITICAL SECURITY INVARIANT: User record MUST remain intact!
        const userCheck = await prisma.user.findUnique({
          where: { id: targetMemberUser.id },
        });
        expect(userCheck).not.toBeNull();
        expect(userCheck?.id).toBe(targetMemberUser.id);
      }
    });

    it('should reactivate soft-deleted membership when user is re-invited', async () => {
      const slug = testSlug('reactivate-member');
      const org = await prisma.organization.create({
        data: { name: 'Reactivate Org', slug },
      });

      const memberRole = await prisma.role.findFirst({
        where: { name: 'MEMBER', organizationId: null },
      });
      expect(memberRole).toBeDefined();

      const user = await prisma.user.create({
        data: {
          email: testEmail('reactivate-user'),
          passwordHash: await hashPassword('Pass123!'),
          firstName: 'Reactivate',
          lastName: 'User',
        },
      });

      if (memberRole) {
        const oldMembership = await prisma.membership.create({
          data: {
            userId: user.id,
            organizationId: org.id,
            roleId: memberRole.id,
            status: MembershipStatus.SUSPENDED,
            joinedAt: new Date(),
            deletedAt: new Date(),
          },
        });

        const reactivated = (await memberService.inviteMember(org.id, user.id, {
          email: user.email,
          roleId: memberRole.id,
        })) as { id: string; deletedAt: Date | null; status: string };

        expect(reactivated.id).toBe(oldMembership.id);
        expect(reactivated.deletedAt).toBeNull();
        expect(reactivated.status).toBe(MembershipStatus.ACTIVE);
      }
    });
  });
});
