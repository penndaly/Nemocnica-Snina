import { Module } from '@nestjs/common';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';
import { NcziXmlService } from './nczi-xml.service';
import { AuditModule } from '../audit/audit.module';
import { HisModule } from '../his/his.module';
import { SmsModule } from '../sms/sms.module';

@Module({
  imports: [AuditModule, HisModule, SmsModule],
  controllers: [OnboardingController],
  providers: [OnboardingService, NcziXmlService],
})
export class OnboardingModule {}
