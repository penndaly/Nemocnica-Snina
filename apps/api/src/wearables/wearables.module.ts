import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { HisModule } from '../his/his.module';
import { SmsModule } from '../sms/sms.module';
import { WearablesController } from './wearables.controller';
import { WearablesAdminController } from './wearables-admin.controller';
import { WearablesMonitoringController } from './wearables-monitoring.controller';
import { WearablesAdminService } from './wearables-admin.service';
import { WearablesMonitoringService } from './wearables-monitoring.service';
import { GarminWebhookController } from './webhooks/garmin.webhook.controller';
import { WearablesService } from './wearables.service';
import { ConsentService } from './consent.service';
import { ConsentGuard } from './consent.guard';
import { TokenCryptoService } from './token-crypto.service';
import { OAuthStateService } from './oauth-state.service';
import { AlertService } from './alert.service';
import { WearablesQueueService } from './wearables-queue.service';
import { WearablesAlertConsumer } from './alert.consumer';
import { WearablesFhirConsumer } from './fhir-export.consumer';
import { WEARABLES_KV, WearablesRedisService } from './wearables-redis.service';
import { WearablesDigestService } from './wearables-digest.service';
import { WearablesCronService } from './wearables-cron.service';
import { MedicalAdaptersModule } from './adapters/medical/medical-adapters.module';
import { ConsumerAdaptersModule } from './adapters/consumer/consumer-adapters.module';

/**
 * Wearables & Remote Monitoring module.
 *
 * W1 — data model, consent engine, config gate, mock adapter.
 * W4 — portal wiring (devices, readings, consent, connect/sync flows).
 * W5 — alert engine + RabbitMQ publisher/consumers (ns.wearables) + FHIR export
 *      + physician view/thresholds + portal notifications.
 * WL9 — Redis-backed OAuth state (one-time-use), batch-alert digest windows,
 *       retention/consent-grace crons. WEARABLES_KV → WearablesRedisService.
 *
 * HisModule is imported for RabbitMQ/FHIR config parity; SmsModule for the
 * critical-alert escalation SMS. The active adapter is selected by
 * WEARABLES_PROVIDER (mock in dev/CI).
 */
@Module({
  imports: [ConfigModule, PrismaModule, AuditModule, AuthModule, HisModule, SmsModule, MedicalAdaptersModule, ConsumerAdaptersModule],
  controllers: [WearablesController, WearablesAdminController, WearablesMonitoringController, GarminWebhookController],
  providers: [
    WearablesService,
    WearablesAdminService,
    WearablesMonitoringService,
    ConsentService,
    ConsentGuard,
    TokenCryptoService,
    OAuthStateService,
    AlertService,
    WearablesQueueService,
    WearablesAlertConsumer,
    WearablesFhirConsumer,
    WearablesRedisService,
    // OAuth state + digest depend on the WearablesKv interface; Redis backs it
    // in the wired app (never an in-memory fallback — see WearablesRedisService).
    { provide: WEARABLES_KV, useExisting: WearablesRedisService },
    WearablesDigestService,
    WearablesCronService,
  ],
  exports: [WearablesService, ConsentService, TokenCryptoService, AlertService],
})
export class WearablesModule {}
