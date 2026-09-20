import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WorkerConfigService } from '../config/worker-config.service.js';
import { QueueConnection } from './queue.connection.js';

@Module({
  imports: [ConfigModule],
  providers: [WorkerConfigService, QueueConnection],
  exports: [WorkerConfigService, QueueConnection],
})
export class QueueModule {}
