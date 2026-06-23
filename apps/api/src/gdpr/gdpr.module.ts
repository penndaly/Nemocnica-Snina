import { Module } from '@nestjs/common';
import { GdprService } from './gdpr.service';
import { GdprController } from './gdpr.controller';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
// Sprint A3 — patient_token-keyed GDPR (web-tier) + encrypted export storage
import { PatientGdprService } from './patient-gdpr.service';
import { PatientGdprController } from './patient-gdpr.controller';
import { StorageService } from './storage.service';

@Module({
  imports: [AuditModule, AuthModule],
  controllers: [GdprController, PatientGdprController],
  providers: [GdprService, PatientGdprService, StorageService],
})
export class GdprModule {}
