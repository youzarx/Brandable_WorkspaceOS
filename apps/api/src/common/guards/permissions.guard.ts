import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../database/prisma.service.js';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator.js';
import type { ActiveMembership } from '@platform/types';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true; // No permission requirement on endpoint
    }

    const request = context.switchToHttp().getRequest();
    const membership: ActiveMembership = request.membership;

    if (!membership || !membership.roleId) {
      throw new ForbiddenException('Membership role context required');
    }

    // Live PostgreSQL read: resolve permissions assigned to roleId
    const rolePermissions = await this.prisma.rolePermission.findMany({
      where: { roleId: membership.roleId },
      include: { permission: true },
    });

    const userPermissionKeys = new Set(rolePermissions.map((rp) => rp.permission.key));

    const hasAllPermissions = requiredPermissions.every((perm) => userPermissionKeys.has(perm));

    if (!hasAllPermissions) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
