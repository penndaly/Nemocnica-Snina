import { Module } from '@nestjs/common';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';
import { NcziXmlService } from './nczi-xml.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [OnboardingController],
  providers: [OnboardingService, NcziXmlService],
})
export class OnboardingModule {}
