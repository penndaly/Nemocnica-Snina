import { Module } from '@nestjs/common';
import { PortalController } from './portal.controller';
import { HisModule } from '../his/his.module';
import { SmsModule } from '../sms/sms.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [HisModule, SmsModule, AuditModule],
  controllers: [PortalController],
})
export class PortalModule {}
