import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { HisModule } from '../his/his.module';
import { SmsModule } from '../sms/sms.module';
import { WearablesController } from './wearables.controller';
import { WearablesService } from './wearables.service';
import { ConsentService } from './consent.service';
import { ConsentGuard } from './consent.guard';
import { TokenCryptoService } from './token-crypto.service';
import { OAuthStateService } from './oauth-state.service';
import { AlertService } from './alert.service';
import { WearablesQueueService } from './wearables-queue.service';
import { WearablesAlertConsumer } from './alert.consumer';
import { WearablesFhirConsumer } from './fhir-export.consumer';
import { MockAdapter } from './mock.adapter';
import { WEARABLE_ADAPTER } from './platform-adapter.interface';

/**
 * Wearables & Remote Monitoring module.
 *
 * W1 — data model, consent engine, config gate, mock adapter.
 * W4 — portal wiring (devices, readings, consent, connect/sync flows).
 * W5 — alert engine + RabbitMQ publisher/consumers (ns.wearables) + FHIR export
 *      + physician view/thresholds + portal notifications.
 *
 * HisModule is imported for RabbitMQ/FHIR config parity; SmsModule for the
 * critical-alert escalation SMS. The active adapter is selected by
 * WEARABLES_PROVIDER (mock in dev/CI).
 */
@Module({
  imports: [ConfigModule, PrismaModule, AuditModule, HisModule, SmsModule],
  controllers: [WearablesController],
  providers: [
    WearablesService,
    ConsentService,
    ConsentGuard,
    TokenCryptoService,
    OAuthStateService,
    AlertService,
    WearablesQueueService,
    WearablesAlertConsumer,
    WearablesFhirConsumer,
    MockAdapter,
    {
      provide: WEARABLE_ADAPTER,
      // W1 ships mock only. W2/W3 will switch on WEARABLES_PROVIDER=live and
      // route per-platform to the real adapters.
      useExisting: MockAdapter,
    },
  ],
  exports: [WearablesService, ConsentService, TokenCryptoService, AlertService],
})
export class WearablesModule {}
