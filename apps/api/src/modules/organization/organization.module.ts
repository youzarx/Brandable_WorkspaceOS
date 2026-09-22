import { Module } from '@nestjs/common';
import { OrganizationController } from './organization.controller.js';
import { OrganizationService } from './organization.service.js';
import { DatabaseModule } from '../../database/database.module.js';

@Module({
  imports: [DatabaseModule],
  controllers: [OrganizationController],
  providers: [OrganizationService],
  exports: [OrganizationService],
})
export class OrganizationModule {}
