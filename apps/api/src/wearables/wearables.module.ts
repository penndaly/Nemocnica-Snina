import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { HisModule } from '../his/his.module';
import { WearablesController } from './wearables.controller';
import { WearablesService } from './wearables.service';
import { ConsentService } from './consent.service';
import { ConsentGuard } from './consent.guard';
import { TokenCryptoService } from './token-crypto.service';
import { OAuthStateService } from './oauth-state.service';
import { MockAdapter } from './mock.adapter';
import { WEARABLE_ADAPTER } from './platform-adapter.interface';

/**
 * Wearables & Remote Monitoring module — Sprint W1.
 *
 * HisModule is imported for RabbitMQ access (HisQueueService) — the W2 sync job
 * and W5 FHIR export publish to the same ns.his topology used by telehealth.
 * The active platform adapter is selected by WEARABLES_PROVIDER (mock in W1).
 */
@Module({
  imports: [ConfigModule, PrismaModule, AuditModule, HisModule],
  controllers: [WearablesController],
  providers: [
    WearablesService,
    ConsentService,
    ConsentGuard,
    TokenCryptoService,
    OAuthStateService,
    MockAdapter,
    {
      provide: WEARABLE_ADAPTER,
      // W1 ships mock only. W2/W3 will switch on WEARABLES_PROVIDER=live and
      // route per-platform to the real adapters.
      useExisting: MockAdapter,
    },
  ],
  exports: [WearablesService, ConsentService, TokenCryptoService],
})
export class WearablesModule {}
