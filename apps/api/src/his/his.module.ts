import { Module } from '@nestjs/common';
import { HisQueueService } from './his-queue.service';
import { HisSyncConsumer } from './his-sync.consumer';
import { FhirReadService } from './fhir-read.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  providers: [HisQueueService, HisSyncConsumer, FhirReadService],
  exports: [HisQueueService, FhirReadService],
})
export class HisModule {}
