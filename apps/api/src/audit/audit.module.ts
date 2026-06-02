import { Module } from '@nestjs/common';
import { AuditService } from './audit.service';

// PrismaModule is @Global() — no import needed here.
@Module({
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
