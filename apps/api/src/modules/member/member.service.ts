import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { hashPassword, generateRawRefreshToken } from '@platform/auth';
import { MembershipStatus } from '@platform/database';
import type { InviteMemberInput, UpdateMemberRoleInput } from '@platform/validation';

@Injectable()
export class MemberService {
  constructor(private readonly prisma: PrismaService) {}

  private async getActorRole(organizationId: string, currentUserId: string) {
    const actorMembership = await this.prisma.membership.findFirst({
      where: {
        userId: currentUserId,
        organizationId,
        deletedAt: null,
        status: MembershipStatus.ACTIVE,
        organization: { deletedAt: null },
      },
      include: { role: true },
    });

    if (!actorMembership) {
      throw new ForbiddenException('Active membership required in organization');
    }

    return actorMembership.role;
  }

  async listMembers(organizationId: string): Promise<unknown[]> {
    const memberships = await this.prisma.membership.findMany({
      where: {
        organizationId,
        deletedAt: null,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            lastLoginAt: true,
          },
        },
        role: {
          select: {
            id: true,
            name: true,
            description: true,
            isSystem: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return memberships;
  }

  async listRoles(organizationId: string): Promise<unknown[]> {
    const roles = await this.prisma.role.findMany({
      where: {
        OR: [{ organizationId: null, isSystem: true }, { organizationId }],
      },
      orderBy: { name: 'asc' },
    });

    return roles;
  }

  async inviteMember(
    organizationId: string,
    currentUserId: string,
    input: InviteMemberInput,
  ): Promise<unknown> {
    const actorRole = await this.getActorRole(organizationId, currentUserId);

    // 1. Verify Role exists and is accessible for this org
    const role = await this.prisma.role.findFirst({
      where: {
        id: input.roleId,
        OR: [{ organizationId: null, isSystem: true }, { organizationId }],
      },
    });

    if (!role) {
      throw new BadRequestException('Invalid role specified');
    }

    // 2. Ownership Privilege Rule: Only active OWNER can assign OWNER role
    if (role.name === 'OWNER' && actorRole.name !== 'OWNER') {
      throw new ForbiddenException('Only an active OWNER can assign the OWNER role');
    }

    // 3. Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: input.email },
    });

    if (existingUser) {
      const existingMembership = await this.prisma.membership.findFirst({
        where: {
          userId: existingUser.id,
          organizationId,
        },
      });

      if (existingMembership) {
        if (existingMembership.deletedAt === null) {
          throw new ConflictException('User is already a member of this organization');
        }

        // Reactivate soft-deleted membership
        const reactivated = await this.prisma.$transaction(async (tx) => {
          const updated = await tx.membership.update({
            where: { id: existingMembership.id },
            data: {
              deletedAt: null,
              roleId: role.id,
              status: MembershipStatus.ACTIVE,
              joinedAt: new Date(),
            },
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                  lastLoginAt: true,
                },
              },
              role: {
                select: {
                  id: true,
                  name: true,
                  description: true,
                  isSystem: true,
                },
              },
            },
          });

          await tx.auditLog.create({
            data: {
              organizationId,
              userId: currentUserId,
              action: 'membership.reactivated',
              resource: 'Membership',
              resourceId: updated.id,
              metadata: { targetUserId: existingUser.id, role: role.name },
            },
          });

          return updated;
        });

        return reactivated;
      }

      // User exists, create new membership
      const newMembership = await this.prisma.$transaction(async (tx) => {
        const created = await tx.membership.create({
          data: {
            userId: existingUser.id,
            organizationId,
            roleId: role.id,
            status: MembershipStatus.ACTIVE,
            joinedAt: new Date(),
          },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                lastLoginAt: true,
              },
            },
            role: {
              select: {
                id: true,
                name: true,
                description: true,
                isSystem: true,
              },
            },
          },
        });

        await tx.auditLog.create({
          data: {
            organizationId,
            userId: currentUserId,
            action: 'membership.created',
            resource: 'Membership',
            resourceId: created.id,
            metadata: { targetUserId: existingUser.id, role: role.name },
          },
        });

        return created;
      });

      return newMembership;
    }

    // 4. User does not exist — create invited user identity & membership
    const placeholderPassword = await hashPassword(generateRawRefreshToken());
    const result = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: input.email,
          passwordHash: placeholderPassword,
          firstName: 'Invited',
          lastName: 'Member',
        },
      });

      const created = await tx.membership.create({
        data: {
          userId: newUser.id,
          organizationId,
          roleId: role.id,
          status: MembershipStatus.PENDING,
          invitedAt: new Date(),
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              lastLoginAt: true,
            },
          },
          role: {
            select: {
              id: true,
              name: true,
              description: true,
              isSystem: true,
            },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId,
          userId: currentUserId,
          action: 'membership.invited',
          resource: 'Membership',
          resourceId: created.id,
          metadata: { targetEmail: input.email, role: role.name },
        },
      });

      return created;
    });

    return result;
  }

  async updateMemberRole(
    organizationId: string,
    membershipId: string,
    currentUserId: string,
    input: UpdateMemberRoleInput,
  ): Promise<unknown> {
    const actorRole = await this.getActorRole(organizationId, currentUserId);

    const targetMembership = await this.prisma.membership.findFirst({
      where: {
        id: membershipId,
        organizationId,
        deletedAt: null,
      },
      include: { role: true },
    });

    if (!targetMembership) {
      throw new NotFoundException('Member not found in organization');
    }

    const newRole = await this.prisma.role.findFirst({
      where: {
        id: input.roleId,
        OR: [{ organizationId: null, isSystem: true }, { organizationId }],
      },
    });

    if (!newRole) {
      throw new BadRequestException('Invalid role specified');
    }

    // 1. Escalation check: Only active OWNER can assign OWNER role
    if (newRole.name === 'OWNER' && actorRole.name !== 'OWNER') {
      throw new ForbiddenException('Only an active OWNER can assign the OWNER role');
    }

    // 2. Modifying OWNER check: Only active OWNER can modify an OWNER membership
    if (targetMembership.role.name === 'OWNER' && actorRole.name !== 'OWNER') {
      throw new ForbiddenException('Only an active OWNER can modify an OWNER membership');
    }

    // 3. Sole OWNER protection check
    if (targetMembership.role.name === 'OWNER' && newRole.name !== 'OWNER') {
      const ownerCount = await this.prisma.membership.count({
        where: {
          organizationId,
          deletedAt: null,
          status: MembershipStatus.ACTIVE,
          role: { name: 'OWNER' },
        },
      });

      if (ownerCount <= 1) {
        throw new BadRequestException('Cannot change role of the sole OWNER of the organization');
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.membership.update({
        where: { id: membershipId },
        data: { roleId: newRole.id },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              lastLoginAt: true,
            },
          },
          role: {
            select: {
              id: true,
              name: true,
              description: true,
              isSystem: true,
            },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId,
          userId: currentUserId,
          action: 'membership.role_updated',
          resource: 'Membership',
          resourceId: membershipId,
          metadata: {
            targetUserId: targetMembership.userId,
            oldRole: targetMembership.role.name,
            newRole: newRole.name,
          },
        },
      });

      return result;
    });

    return updated;
  }

  async removeMember(
    organizationId: string,
    membershipId: string,
    currentUserId: string,
  ): Promise<{ message: string }> {
    const actorRole = await this.getActorRole(organizationId, currentUserId);

    const targetMembership = await this.prisma.membership.findFirst({
      where: {
        id: membershipId,
        organizationId,
        deletedAt: null,
      },
      include: { role: true },
    });

    if (!targetMembership) {
      throw new NotFoundException('Member not found in organization');
    }

    // 1. Modifying/removing OWNER check: Only active OWNER can remove an OWNER membership
    if (targetMembership.role.name === 'OWNER' && actorRole.name !== 'OWNER') {
      throw new ForbiddenException('Only an active OWNER can remove an OWNER membership');
    }

    // 2. Sole OWNER protection check
    if (targetMembership.role.name === 'OWNER') {
      const ownerCount = await this.prisma.membership.count({
        where: {
          organizationId,
          deletedAt: null,
          status: MembershipStatus.ACTIVE,
          role: { name: 'OWNER' },
        },
      });

      if (ownerCount <= 1) {
        throw new BadRequestException('Cannot remove the sole OWNER of the organization');
      }
    }

    await this.prisma.$transaction(async (tx) => {
      // Soft-delete membership ONLY — User entity remains intact
      await tx.membership.update({
        where: { id: membershipId },
        data: {
          deletedAt: new Date(),
          status: MembershipStatus.SUSPENDED,
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId,
          userId: currentUserId,
          action: 'membership.deleted',
          resource: 'Membership',
          resourceId: membershipId,
          metadata: { targetUserId: targetMembership.userId, role: targetMembership.role.name },
        },
      });
    });

    return { message: 'Member removed successfully' };
  }
}
