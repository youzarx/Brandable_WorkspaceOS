import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { OrganizationService } from './organization.service.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { MembershipGuard } from '../../common/guards/membership.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator.js';
import { CurrentMembership } from '../../common/decorators/current-membership.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { updateOrganizationSchema, type UpdateOrganizationInput } from '@platform/validation';
import type { ActiveMembership, AuthenticatedUser } from '@platform/types';
import type { Organization } from '@platform/database';

@Controller('organizations')
@UseGuards(JwtAuthGuard, MembershipGuard, PermissionsGuard)
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Get('current')
  @RequirePermissions('organizations.read')
  async getCurrent(@CurrentMembership() membership: ActiveMembership): Promise<Organization> {
    return this.organizationService.getOrganization(membership.organizationId);
  }

  @Patch('current')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('organizations.update')
  async updateCurrent(
    @CurrentMembership() membership: ActiveMembership,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: UpdateOrganizationInput,
  ): Promise<Organization> {
    const validatedInput = updateOrganizationSchema.parse(body);
    return this.organizationService.updateOrganization(
      membership.organizationId,
      user.id,
      validatedInput,
    );
  }
}
