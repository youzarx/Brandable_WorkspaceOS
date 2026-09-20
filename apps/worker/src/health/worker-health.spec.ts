import { describe, it, expect } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { WorkerConfigService } from '../config/worker-config.service.js';
import { QueueConnection } from '../queue/queue.connection.js';
import { WorkerHealthService } from './worker-health.service.js';

describe('WorkerHealthService', () => {
  function createHealthService(env: Record<string, string | boolean>): {
    healthService: WorkerHealthService;
    configService: WorkerConfigService;
    queueConnection: QueueConnection;
  } {
    const configService = new WorkerConfigService(new ConfigService(env));
    const queueConnection = new QueueConnection(configService);
    const healthService = new WorkerHealthService(configService, queueConnection);
    return { healthService, configService, queueConnection };
  }

  it('reports status=ok when worker is initialized and enabled', () => {
    const { healthService } = createHealthService({
      WORKER_ENABLED: 'true',
      REDIS_URL: 'redis://localhost:6379',
      WORKER_CONCURRENCY: '8',
    });

    healthService.onModuleInit();
    const report = healthService.getHealthReport();

    expect(report.status).toBe('ok');
    expect(report.workerInitialized).toBe(true);
    expect(report.concurrency).toBe(8);
    expect(report.queueSubsystem.enabled).toBe(true);
    expect(report.timestamp).toBeDefined();
  });

  it('reports status=disabled when WORKER_ENABLED=false', () => {
    const { healthService } = createHealthService({
      WORKER_ENABLED: 'false',
    });

    healthService.onModuleInit();
    const report = healthService.getHealthReport();

    expect(report.status).toBe('disabled');
    expect(report.workerInitialized).toBe(true);
    expect(report.queueSubsystem.enabled).toBe(false);
  });

  it('handles lifecycle destruction correctly', () => {
    const { healthService } = createHealthService({
      WORKER_ENABLED: 'true',
    });

    healthService.onModuleInit();
    expect(healthService.getHealthReport().workerInitialized).toBe(true);

    healthService.onModuleDestroy();
    expect(healthService.getHealthReport().workerInitialized).toBe(false);
  });
});
