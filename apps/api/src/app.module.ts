import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import { ApiConfigModule } from './config/api-config.module.js';
import { DatabaseModule } from './database/database.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { OrganizationModule } from './modules/organization/organization.module.js';
import { MemberModule } from './modules/member/member.module.js';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';
import { MembershipGuard } from './common/guards/membership.guard.js';
import { ModuleGuard } from './common/guards/module.guard.js';
import { PermissionsGuard } from './common/guards/permissions.guard.js';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter.js';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor.js';
import { TransformInterceptor } from './common/interceptors/transform.interceptor.js';
import { TenantService } from './common/services/tenant.service.js';

@Module({
  imports: [
    ApiConfigModule,
    DatabaseModule,
    AuthModule,
    HealthModule,
    OrganizationModule,
    MemberModule,
  ],
  providers: [
    TenantService,
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: MembershipGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ModuleGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
  ],
})
export class AppModule {}
