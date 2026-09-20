import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module.js';
import { ApiConfigService } from './config/api-config.service.js';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  const apiConfig = app.get(ApiConfigService);

  // Global prefix: /api/v1
  app.setGlobalPrefix(`${apiConfig.apiPrefix}/${apiConfig.apiVersion}`);

  // Cookie parser middleware for HttpOnly refresh token cookie
  app.use(cookieParser(apiConfig.cookieSecret));

  // CORS configuration
  app.enableCors({
    origin: apiConfig.corsOrigin.split(',').map((o: string) => o.trim()),
    credentials: true,
  });

  await app.listen(apiConfig.port);
  logger.log(
    `🚀 NestJS API server running on http://localhost:${apiConfig.port}${apiConfig.apiPrefix}/${apiConfig.apiVersion}`,
  );
}

bootstrap().catch((err) => {
  console.error('❌ API Bootstrap failure:', err);
  process.exit(1);
});
