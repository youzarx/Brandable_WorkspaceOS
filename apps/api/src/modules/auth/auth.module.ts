import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { JwtStrategy } from './jwt.strategy.js';
import { InProcessRateLimiterService } from '../../common/rate-limit/in-process-rate-limiter.service.js';
import { ApiConfigService } from '../../config/api-config.service.js';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      useFactory: (config: ApiConfigService) => ({
        secret: config.jwtAccessSecret,
        signOptions: { expiresIn: config.jwtAccessExpiry as unknown as number },
      }),
      inject: [ApiConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, InProcessRateLimiterService],
  exports: [AuthService, PassportModule, JwtModule],
})
export class AuthModule {}
