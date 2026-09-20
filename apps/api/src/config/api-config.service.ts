import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvConfig } from '@platform/validation';

@Injectable()
export class ApiConfigService {
  constructor(private readonly configService: ConfigService<EnvConfig, true>) {}

  get nodeEnv(): string {
    return this.configService.get('NODE_ENV', { infer: true });
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  get port(): number {
    return this.configService.get('API_PORT', { infer: true });
  }

  get apiPrefix(): string {
    return this.configService.get('API_PREFIX', { infer: true });
  }

  get apiVersion(): string {
    return this.configService.get('API_VERSION', { infer: true });
  }

  get jwtAccessSecret(): string {
    return this.configService.get('JWT_ACCESS_SECRET', { infer: true });
  }

  get jwtAccessExpiry(): string {
    return this.configService.get('JWT_ACCESS_EXPIRY', { infer: true });
  }

  get jwtRefreshExpiryDays(): number {
    return this.configService.get('JWT_REFRESH_EXPIRY_DAYS', { infer: true });
  }

  get cookieSecret(): string {
    return this.configService.get('COOKIE_SECRET', { infer: true });
  }

  get cookieSameSite(): 'Strict' | 'Lax' | 'None' {
    return this.configService.get('COOKIE_SAME_SITE', { infer: true });
  }

  get cookieDomain(): string | undefined {
    return this.configService.get('COOKIE_DOMAIN', { infer: true });
  }

  get databaseUrl(): string {
    return this.configService.get('DATABASE_URL', { infer: true });
  }

  get corsOrigin(): string {
    return this.configService.get('CORS_ORIGIN', { infer: true });
  }
}
