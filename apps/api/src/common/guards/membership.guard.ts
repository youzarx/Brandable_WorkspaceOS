import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import type { AuthenticatedUser, ActiveMembership } from '@platform/types';
import { MembershipStatus } from '@platform/database';

@Injectable()
export class MembershipGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser = request.user;

    if (!user || !user.id) {
      throw new ForbiddenException('User context missing');
    }

    // Server-side tenant resolution: organizationId is NEVER trusted from body/query/headers/JWT claims
    // Header/param is only used to specify target org slug or ID, which MUST be validated against DB membership
    const targetOrgId =
      request.params['organizationId'] ||
      request.params['orgId'] ||
      request.headers['x-organization-id'];

    let membership;
    if (targetOrgId) {
      membership = await this.prisma.membership.findFirst({
        where: {
          userId: user.id,
          organizationId: targetOrgId as string,
          deletedAt: null,
          organization: { deletedAt: null },
        },
        include: { organization: true, role: true },
      });
    } else {
      // Default to first active membership
      membership = await this.prisma.membership.findFirst({
        where: {
          userId: user.id,
          status: MembershipStatus.ACTIVE,
          deletedAt: null,
          organization: { deletedAt: null },
        },
        include: { organization: true, role: true },
      });
    }

    if (!membership) {
      // 404 to avoid disclosing existence of other tenants' resources
      throw new NotFoundException('Organization membership not found');
    }

    if (membership.status !== MembershipStatus.ACTIVE) {
      throw new ForbiddenException(`Membership status is ${membership.status}`);
    }

    const activeMembership: ActiveMembership = {
      id: membership.id,
      membershipId: membership.id,
      userId: membership.userId,
      organizationId: membership.organizationId,
      organizationSlug: membership.organization.slug,
      organizationName: membership.organization.name,
      roleId: membership.roleId,
      roleName: membership.role.name,
      permissions: [],
      status: membership.status as 'PENDING' | 'ACTIVE' | 'SUSPENDED',
    };

    request.membership = activeMembership;
    return true;
  }
}
