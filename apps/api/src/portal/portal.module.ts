import { Module } from '@nestjs/common';
import { PortalController } from './portal.controller';
import { HisModule } from '../his/his.module';
import { SmsModule } from '../sms/sms.module';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [HisModule, SmsModule, AuditModule, PrismaModule],
  controllers: [PortalController],
})
export class PortalModule {}
