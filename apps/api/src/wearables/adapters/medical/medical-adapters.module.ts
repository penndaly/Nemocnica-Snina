/**
 * MedicalAdaptersModule (Sprint W2) — the medical-grade platform adapters plus
 * the AdapterRegistry that selects one by platform at runtime.
 *
 * Provides its own TokenCryptoService (stateless, keyed by WEARABLES_TOKEN_KEY)
 * and MockAdapter so the registry resolves without reaching into WearablesModule.
 * WearablesModule imports this module and consumes AdapterRegistry.
 *
 * W3's ConsumerAdaptersModule will import this module (for AdapterRegistry +
 * WithingsAdapter, which is shared) and register the consumer adapters.
 */
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../../../auth/auth.module';
import { AuditModule } from '../../../audit/audit.module';
import { TokenCryptoService } from '../../token-crypto.service';
import { MockAdapter } from '../../mock.adapter';
import { AdapterRegistry } from '../adapter-registry.service';
import { AbbottLibreAdapter } from './abbott-libre.adapter';
import { DexcomAdapter } from './dexcom.adapter';
import { WithingsAdapter } from './withings.adapter';
import { OmronAdapter } from './omron.adapter';
import { MedtronicCgmAdapter } from './medtronic-cgm.adapter';
import { MedtronicCardiacAdapter } from './medtronic-cardiac.adapter';
import { AbbottCardiacAdapter } from './abbott-cardiac.adapter';
import { BscLatitudeAdapter } from './bsc-latitude.adapter';
import { AlivecorAdapter } from './alivecor.adapter';
import { KardiaUploadController } from './kardia-upload.controller';

@Module({
  imports: [ConfigModule, AuthModule, AuditModule],
  controllers: [KardiaUploadController],
  providers: [
    TokenCryptoService,
    MockAdapter,
    AbbottLibreAdapter,
    DexcomAdapter,
    WithingsAdapter,
    OmronAdapter,
    MedtronicCgmAdapter,
    MedtronicCardiacAdapter,
    AbbottCardiacAdapter,
    BscLatitudeAdapter,
    AlivecorAdapter,
    AdapterRegistry,
  ],
  exports: [AdapterRegistry, WithingsAdapter],
})
export class MedicalAdaptersModule {}
