import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { URL } from 'node:url';

@Injectable()
export class WorkerConfigService implements OnModuleInit {
  private readonly logger = new Logger(WorkerConfigService.name);

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    this.validateConfig();
  }

  public validateConfig(): void {
    const isEnabled = this.isWorkerEnabled();
    const redisUrl = this.getRedisUrl();
    const concurrency = this.getWorkerConcurrency();

    if (concurrency < 1 || isNaN(concurrency)) {
      const msg = `Invalid WORKER_CONCURRENCY: "${concurrency}". Must be an integer >= 1.`;
      this.logger.error(msg);
      throw new Error(msg);
    }

    if (isEnabled) {
      if (!redisUrl || (!redisUrl.startsWith('redis://') && !redisUrl.startsWith('rediss://'))) {
        const msg = `Invalid REDIS_URL configuration: "${redisUrl}". Must start with redis:// or rediss://`;
        this.logger.error(msg);
        throw new Error(msg);
      }
    }
  }

  public isWorkerEnabled(): boolean {
    const raw = this.configService.get<string | boolean>('WORKER_ENABLED', 'true');
    if (typeof raw === 'boolean') {
      return raw;
    }
    return String(raw).toLowerCase() !== 'false';
  }

  public getRedisUrl(): string {
    return this.configService.get<string>('REDIS_URL', 'redis://localhost:6379');
  }

  public getQueuePrefix(): string {
    return this.configService.get<string>('QUEUE_PREFIX', 'platform_queue');
  }

  public getWorkerConcurrency(): number {
    const raw = this.configService.get<string | number>('WORKER_CONCURRENCY', 5);
    const parsed = Number(raw);
    return isNaN(parsed) ? 5 : Math.floor(parsed);
  }

  /**
   * Parse Redis connection options for BullMQ / ioredis connection options.
   */
  public getRedisOptions(): { host: string; port: number; password?: string; db?: number } {
    const rawUrl = this.getRedisUrl();
    try {
      const parsed = new URL(rawUrl);
      const port = parsed.port ? parseInt(parsed.port, 10) : 6379;
      const host = parsed.hostname || 'localhost';
      const password = parsed.password ? decodeURIComponent(parsed.password) : undefined;
      const db =
        parsed.pathname && parsed.pathname.length > 1
          ? parseInt(parsed.pathname.substring(1), 10)
          : undefined;

      const opts: { host: string; port: number; password?: string; db?: number } = { host, port };
      if (password) opts.password = password;
      if (db !== undefined && !isNaN(db)) opts.db = db;
      return opts;
    } catch {
      return { host: 'localhost', port: 6379 };
    }
  }
}
