import { Module } from '@nestjs/common';
import { MemberController } from './member.controller.js';
import { MemberService } from './member.service.js';
import { DatabaseModule } from '../../database/database.module.js';

@Module({
  imports: [DatabaseModule],
  controllers: [MemberController],
  providers: [MemberService],
  exports: [MemberService],
})
export class MemberModule {}
