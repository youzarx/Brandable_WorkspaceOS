import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { MemberService } from './member.service.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { MembershipGuard } from '../../common/guards/membership.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator.js';
import { CurrentMembership } from '../../common/decorators/current-membership.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import {
  inviteMemberSchema,
  updateMemberRoleSchema,
  type InviteMemberInput,
  type UpdateMemberRoleInput,
} from '@platform/validation';
import type { ActiveMembership, AuthenticatedUser } from '@platform/types';

@Controller('organizations/current')
@UseGuards(JwtAuthGuard, MembershipGuard, PermissionsGuard)
export class MemberController {
  constructor(private readonly memberService: MemberService) {}

  @Get('members')
  @RequirePermissions('memberships.read')
  async listMembers(@CurrentMembership() membership: ActiveMembership): Promise<unknown[]> {
    return this.memberService.listMembers(membership.organizationId);
  }

  @Get('roles')
  @RequirePermissions('roles.read')
  async listRoles(@CurrentMembership() membership: ActiveMembership): Promise<unknown[]> {
    return this.memberService.listRoles(membership.organizationId);
  }

  @Post('members')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('users.invite')
  async inviteMember(
    @CurrentMembership() membership: ActiveMembership,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: InviteMemberInput,
  ): Promise<unknown> {
    const validatedInput = inviteMemberSchema.parse(body);
    return this.memberService.inviteMember(membership.organizationId, user.id, validatedInput);
  }

  @Patch('members/:membershipId')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('memberships.manage')
  async updateMemberRole(
    @CurrentMembership() membership: ActiveMembership,
    @CurrentUser() user: AuthenticatedUser,
    @Param('membershipId') membershipId: string,
    @Body() body: UpdateMemberRoleInput,
  ): Promise<unknown> {
    const validatedInput = updateMemberRoleSchema.parse(body);
    return this.memberService.updateMemberRole(
      membership.organizationId,
      membershipId,
      user.id,
      validatedInput,
    );
  }

  @Delete('members/:membershipId')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('users.remove')
  async removeMember(
    @CurrentMembership() membership: ActiveMembership,
    @CurrentUser() user: AuthenticatedUser,
    @Param('membershipId') membershipId: string,
  ): Promise<{ message: string }> {
    return this.memberService.removeMember(membership.organizationId, membershipId, user.id);
  }
}
