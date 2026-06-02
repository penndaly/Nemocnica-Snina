import { Module } from '@nestjs/common';
import { HisQueueService } from './his-queue.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  providers: [HisQueueService],
  exports: [HisQueueService],
})
export class HisModule {}
