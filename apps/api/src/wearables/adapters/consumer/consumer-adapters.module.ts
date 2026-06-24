/**
 * ConsumerAdaptersModule (Sprint W3) — the consumer-platform adapters.
 *
 * AdapterRegistry lives in MedicalAdaptersModule, which this module imports.
 * Constructor-injecting the consumer adapters INTO that registry would be a
 * circular module dependency (Medical ← Consumer ← Medical), so instead the
 * registry exposes register() and this module self-registers its adapters on
 * init. Same end state as the spec's "extend the constructor", without the cycle.
 *
 * WithingsAdapter is NOT re-declared — it is exported by MedicalAdaptersModule
 * and already registered there for consumer Withings devices too.
 */
import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WearablePlatform } from '@prisma/client';
import { PrismaModule } from '../../../prisma/prisma.module';
import { TokenCryptoService } from '../../token-crypto.service';
import { AdapterRegistry } from '../adapter-registry.service';
import { MedicalAdaptersModule } from '../medical/medical-adapters.module';
import { FitbitAdapter } from './fitbit.adapter';
import { GarminAdapter } from './garmin.adapter';
import { GoogleHealthAdapter } from './google-health.adapter';
import { SamsungHealthAdapter } from './samsung-health.adapter';
import { AppleHealthAdapter } from './apple-health.adapter';
import { HuaweiAdapter } from './huawei.adapter';
import { MetaAdapter } from './meta.adapter';
import { XiaomiAdapter } from './xiaomi.adapter';

@Module({
  imports: [ConfigModule, PrismaModule, MedicalAdaptersModule],
  providers: [
    TokenCryptoService,
    FitbitAdapter,
    GarminAdapter,
    GoogleHealthAdapter,
    SamsungHealthAdapter,
    AppleHealthAdapter,
    HuaweiAdapter,
    MetaAdapter,
    XiaomiAdapter,
  ],
  exports: [
    FitbitAdapter,
    GarminAdapter,
    GoogleHealthAdapter,
    SamsungHealthAdapter,
    AppleHealthAdapter,
    HuaweiAdapter,
    MetaAdapter,
    XiaomiAdapter,
  ],
})
export class ConsumerAdaptersModule implements OnModuleInit {
  constructor(
    private readonly registry: AdapterRegistry,
    private readonly fitbit: FitbitAdapter,
    private readonly garmin: GarminAdapter,
    private readonly googleHealth: GoogleHealthAdapter,
    private readonly samsung: SamsungHealthAdapter,
    private readonly apple: AppleHealthAdapter,
    private readonly huawei: HuaweiAdapter,
    private readonly meta: MetaAdapter,
    private readonly xiaomi: XiaomiAdapter,
  ) {}

  onModuleInit(): void {
    this.registry.register(WearablePlatform.fitbit, this.fitbit);
    this.registry.register(WearablePlatform.garmin, this.garmin);
    this.registry.register(WearablePlatform.google_health, this.googleHealth);
    this.registry.register(WearablePlatform.samsung_health, this.samsung);
    this.registry.register(WearablePlatform.apple_health, this.apple);
    this.registry.register(WearablePlatform.huawei, this.huawei);
    this.registry.register(WearablePlatform.meta, this.meta);
    this.registry.register(WearablePlatform.xiaomi, this.xiaomi);
  }
}
