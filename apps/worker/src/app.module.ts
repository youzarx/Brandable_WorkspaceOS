import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WorkerConfigService } from './config/worker-config.service.js';
import { QueueModule } from './queue/queue.module.js';
import { WorkerHealthService } from './health/worker-health.service.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    QueueModule,
  ],
  providers: [WorkerConfigService, WorkerHealthService],
})
export class AppModule {}
