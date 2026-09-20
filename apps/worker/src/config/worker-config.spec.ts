import { describe, it, expect, beforeEach } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { WorkerConfigService } from './worker-config.service.js';

describe('WorkerConfigService', () => {
  let mockEnv: Record<string, string | boolean>;

  beforeEach(() => {
    mockEnv = {
      WORKER_ENABLED: 'true',
      REDIS_URL: 'redis://localhost:6379',
      QUEUE_PREFIX: 'platform_test_queue',
      WORKER_CONCURRENCY: '5',
    };
  });

  function createConfigService(env: Record<string, string | boolean>): WorkerConfigService {
    const nestConfigService = new ConfigService(env);
    return new WorkerConfigService(nestConfigService);
  }

  it('accepts valid default configuration', () => {
    const service = createConfigService(mockEnv);
    expect(() => service.validateConfig()).not.toThrow();
    expect(service.isWorkerEnabled()).toBe(true);
    expect(service.getRedisUrl()).toBe('redis://localhost:6379');
    expect(service.getQueuePrefix()).toBe('platform_test_queue');
    expect(service.getWorkerConcurrency()).toBe(5);
  });

  it('rejects invalid concurrency values', () => {
    const invalidConcurrencyEnv = { ...mockEnv, WORKER_CONCURRENCY: '0' };
    const service = createConfigService(invalidConcurrencyEnv);
    expect(() => service.validateConfig()).toThrow('Invalid WORKER_CONCURRENCY');
  });

  it('rejects invalid REDIS_URL when worker is enabled', () => {
    const invalidUrlEnv = { ...mockEnv, REDIS_URL: 'invalid-url-schema' };
    const service = createConfigService(invalidUrlEnv);
    expect(() => service.validateConfig()).toThrow('Invalid REDIS_URL configuration');
  });

  it('allows disabled worker mode via WORKER_ENABLED=false', () => {
    const disabledEnv = { ...mockEnv, WORKER_ENABLED: 'false', REDIS_URL: 'invalid' };
    const service = createConfigService(disabledEnv);
    expect(service.isWorkerEnabled()).toBe(false);
    expect(() => service.validateConfig()).not.toThrow();
  });

  it('correctly parses Redis URL connection parameters', () => {
    const urlEnv = { ...mockEnv, REDIS_URL: 'redis://:authpass@redis-host.internal:6380/2' };
    const service = createConfigService(urlEnv);
    const opts = service.getRedisOptions();

    expect(opts.host).toBe('redis-host.internal');
    expect(opts.port).toBe(6380);
    expect(opts.password).toBe('authpass');
    expect(opts.db).toBe(2);
  });
});
