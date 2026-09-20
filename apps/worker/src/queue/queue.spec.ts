import { describe, it, expect, beforeEach } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { WorkerConfigService } from '../config/worker-config.service.js';
import { QueueConnection } from './queue.connection.js';
import { QUEUE_NAMES, ALL_QUEUE_NAMES } from './queue.constants.js';

describe('Queue Subsystem Foundation', () => {
  let mockEnv: Record<string, string | boolean>;

  beforeEach(() => {
    mockEnv = {
      WORKER_ENABLED: 'true',
      REDIS_URL: 'redis://redis-server.internal:6379',
      QUEUE_PREFIX: 'platform_queue_test',
      WORKER_CONCURRENCY: '10',
    };
  });

  function createQueueConnection(env: Record<string, string | boolean>): {
    configService: WorkerConfigService;
    queueConnection: QueueConnection;
  } {
    const configService = new WorkerConfigService(new ConfigService(env));
    const queueConnection = new QueueConnection(configService);
    return { configService, queueConnection };
  }

  it('provides deterministic queue names', () => {
    expect(QUEUE_NAMES.SYSTEM).toBe('system_default');
    expect(ALL_QUEUE_NAMES).toContain('system_default');
  });

  it('passes Redis options to BullMQ connection layer correctly', () => {
    const { queueConnection } = createQueueConnection(mockEnv);
    const opts = queueConnection.getRedisOptions();

    expect(opts.host).toBe('redis-server.internal');
    expect(opts.port).toBe(6379);
    expect(opts.maxRetriesPerRequest).toBeNull(); // Mandatory BullMQ setting
    expect(opts.lazyConnect).toBe(true);
  });

  it('reflects worker enabled / disabled state', () => {
    const { queueConnection: enabledConn } = createQueueConnection(mockEnv);
    expect(enabledConn.isQueueEnabled()).toBe(true);

    const disabledEnv = { ...mockEnv, WORKER_ENABLED: 'false' };
    const { queueConnection: disabledConn } = createQueueConnection(disabledEnv);
    expect(disabledConn.isQueueEnabled()).toBe(false);
  });

  it('reports queue status diagnostics cleanly without requiring live Redis', () => {
    const { queueConnection } = createQueueConnection(mockEnv);
    const status = queueConnection.getStatus();

    expect(status.enabled).toBe(true);
    expect(status.connected).toBe(false); // Unconnected until worker event loop connects
    expect(status.redisUrl).toBe('redis://redis-server.internal:6379');
  });
});
