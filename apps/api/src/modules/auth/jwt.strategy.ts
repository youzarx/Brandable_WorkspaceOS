import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ApiConfigService } from '../../config/api-config.service.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { JwtPayload, AuthenticatedUser } from '@platform/types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    apiConfig: ApiConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: apiConfig.jwtAccessSecret,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    if (!payload.sub) {
      throw new UnauthorizedException('Invalid token payload');
    }

    // Live PostgreSQL query: verify user exists and deletedAt IS NULL
    const user = await this.prisma.user.findFirst({
      where: {
        id: payload.sub,
        deletedAt: null,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User identity not found or deactivated');
    }

    return {
      id: user.id,
      userId: user.id,
      email: user.email,
      firstName: user.firstName ?? undefined,
      lastName: user.lastName ?? undefined,
    };
  }
}
