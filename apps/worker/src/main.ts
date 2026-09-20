import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module.js';
import { WorkerConfigService } from './config/worker-config.service.js';
import { WorkerHealthService } from './health/worker-health.service.js';

async function bootstrap(): Promise<void> {
  const logger = new Logger('WorkerMain');
  logger.log('Initializing Standalone Worker Application Context...');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  });

  app.enableShutdownHooks();

  const configService = app.get(WorkerConfigService);
  const healthService = app.get(WorkerHealthService);

  const report = healthService.getHealthReport();
  logger.log(
    JSON.stringify({
      event: 'WORKER_STARTUP',
      status: report.status,
      workerEnabled: configService.isWorkerEnabled(),
      concurrency: report.concurrency,
      queueSubsystem: report.queueSubsystem,
      timestamp: report.timestamp,
    }),
  );

  if (!configService.isWorkerEnabled()) {
    logger.warn(
      'WORKER_ENABLED is set to false. Worker standalone process is running in idle mode.',
    );
  }

  const handleShutdown = async (signal: string) => {
    logger.log(`Received ${signal}. Initiating graceful worker shutdown...`);
    try {
      await app.close();
      logger.log('Worker application context closed cleanly.');
      process.exit(0);
    } catch (err: unknown) {
      logger.error('Error during worker shutdown:', err);
      process.exit(1);
    }
  };

  process.on('SIGINT', () => void handleShutdown('SIGINT'));
  process.on('SIGTERM', () => void handleShutdown('SIGTERM'));
}

void bootstrap();
