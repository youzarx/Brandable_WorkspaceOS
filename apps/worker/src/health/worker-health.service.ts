import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { WorkerConfigService } from '../config/worker-config.service.js';
import { QueueConnection } from '../queue/queue.connection.js';

export interface WorkerHealthReport {
  status: 'ok' | 'disabled' | 'error';
  workerInitialized: boolean;
  queueSubsystem: {
    enabled: boolean;
    connected: boolean;
    redisUrl: string;
  };
  concurrency: number;
  uptimeSeconds: number;
  timestamp: string;
}

@Injectable()
export class WorkerHealthService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkerHealthService.name);
  private isInitialized = false;
  private readonly startTime = Date.now();

  constructor(
    private readonly configService: WorkerConfigService,
    private readonly queueConnection: QueueConnection,
  ) {}

  onModuleInit(): void {
    this.isInitialized = true;
    const isEnabled = this.configService.isWorkerEnabled();
    this.logger.log(
      `WorkerHealthService initialized. Worker status: ${isEnabled ? 'ENABLED' : 'DISABLED'}`,
    );
  }

  public getHealthReport(): WorkerHealthReport {
    const isEnabled = this.configService.isWorkerEnabled();
    const queueStatus = this.queueConnection.getStatus();

    let status: 'ok' | 'disabled' | 'error' = 'ok';
    if (!isEnabled) {
      status = 'disabled';
    } else if (!this.isInitialized) {
      status = 'error';
    }

    return {
      status,
      workerInitialized: this.isInitialized,
      queueSubsystem: queueStatus,
      concurrency: this.configService.getWorkerConcurrency(),
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
      timestamp: new Date().toISOString(),
    };
  }

  onModuleDestroy(): void {
    this.isInitialized = false;
    this.logger.log('WorkerHealthService shutdown complete.');
  }
}
