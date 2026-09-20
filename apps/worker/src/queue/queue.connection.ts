import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { WorkerConfigService } from '../config/worker-config.service.js';
import type { RedisOptions } from 'ioredis';

@Injectable()
export class QueueConnection implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueConnection.name);
  private isConnected = false;

  constructor(private readonly configService: WorkerConfigService) {}

  onModuleInit(): void {
    if (!this.configService.isWorkerEnabled()) {
      this.logger.log(
        'Worker is disabled via WORKER_ENABLED=false — QueueConnection bypasses connection.',
      );
      return;
    }
    this.logger.log(
      `QueueConnection initialized for Redis host: ${this.configService.getRedisOptions().host}`,
    );
  }

  /**
   * Get BullMQ / ioredis connection options.
   * Connection is configured lazily to prevent blocking startup when Redis is offline in non-worker environments.
   */
  public getRedisOptions(): RedisOptions {
    const opts = this.configService.getRedisOptions();
    return {
      host: opts.host,
      port: opts.port,
      password: opts.password,
      db: opts.db,
      maxRetriesPerRequest: null, // Required by BullMQ
      enableReadyCheck: false,
      lazyConnect: true,
    };
  }

  public isQueueEnabled(): boolean {
    return this.configService.isWorkerEnabled();
  }

  public getStatus(): { enabled: boolean; connected: boolean; redisUrl: string } {
    return {
      enabled: this.configService.isWorkerEnabled(),
      connected: this.isConnected,
      redisUrl: this.configService.getRedisUrl(),
    };
  }

  async onModuleDestroy(): Promise<void> {
    this.isConnected = false;
    this.logger.log('QueueConnection shutdown complete.');
  }
}
