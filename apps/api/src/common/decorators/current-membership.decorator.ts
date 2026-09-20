import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { ActiveMembership } from '@platform/types';

export const CurrentMembership = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ActiveMembership => {
    const request = ctx.switchToHttp().getRequest();
    return request.membership;
  },
);
