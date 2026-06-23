import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from './audit.module';
import { AuditController } from './audit.controller';

/**
 * Audit read API. Separate from AuditModule so the staff guards (AuthModule)
 * can protect /api/audit without creating an AuthModule⇄AuditModule cycle
 * (AuthModule already imports AuditModule for the write path).
 */
@Module({
  imports: [AuthModule, AuditModule],
  controllers: [AuditController],
})
export class AuditApiModule {}
