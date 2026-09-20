import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { envSchema } from '@platform/validation';
import { ApiConfigService } from './api-config.service.js';

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      validate: (config: Record<string, unknown>) => {
        const result = envSchema.safeParse(config);
        if (!result.success) {
          console.error('❌ Environment validation error:', result.error.format());
          throw new Error('Invalid environment variables');
        }
        return result.data;
      },
    }),
  ],
  providers: [ApiConfigService],
  exports: [ApiConfigService],
})
export class ApiConfigModule {}
