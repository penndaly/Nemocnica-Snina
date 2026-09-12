import { Module } from '@nestjs/common';
import { SatisfactionSurveyController } from './satisfaction-survey.controller';
import { SatisfactionSurveyService } from './satisfaction-survey.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [SatisfactionSurveyController],
  providers: [SatisfactionSurveyService],
})
export class SatisfactionSurveyModule {}
