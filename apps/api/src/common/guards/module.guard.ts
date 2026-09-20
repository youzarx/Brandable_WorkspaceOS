import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../database/prisma.service.js';
import { MODULE_KEY } from '../decorators/require-module.decorator.js';
import type { ActiveMembership } from '@platform/types';

@Injectable()
export class ModuleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredModule = this.reflector.getAllAndOverride<string>(MODULE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredModule) {
      return true; // No module requirement on endpoint
    }

    const request = context.switchToHttp().getRequest();
    const membership: ActiveMembership = request.membership;

    if (!membership || !membership.organizationId) {
      throw new ForbiddenException('Tenant membership context required');
    }

    // Server-side module check via JOIN: OrganizationModule -> Module -> Module.key
    // There is NO moduleKey column on OrganizationModule.
    const orgModule = await this.prisma.organizationModule.findFirst({
      where: {
        organizationId: membership.organizationId,
        module: { key: requiredModule },
        isEnabled: true,
      },
    });

    if (!orgModule) {
      throw new ForbiddenException(`Module "${requiredModule}" is disabled for this organization`);
    }

    return true;
  }
}
