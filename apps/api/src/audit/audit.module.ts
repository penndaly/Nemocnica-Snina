import { Module } from '@nestjs/common';
import { AuditService } from './audit.service';

// PrismaModule is @Global() — no import needed here.
// The read API lives in AuditApiModule to avoid an AuthModule⇄AuditModule cycle.
@Module({
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
