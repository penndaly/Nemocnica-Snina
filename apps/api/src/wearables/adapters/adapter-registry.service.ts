/**
 * Adapter registry (Sprint W2) — the missing architectural piece.
 *
 * W1 wired a single WEARABLE_ADAPTER token to MockAdapter. With 9 medical and N
 * consumer adapters, the service selects the right adapter by platform at runtime.
 * When WEARABLES_PROVIDER=mock (dev/CI default) every platform resolves to the
 * MockAdapter; in live mode the per-platform adapter is returned (partnership /
 * manual-upload stubs included — they implement the interface and throw the
 * catalog gate error from getAuthUrl).
 */
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WearablePlatform } from '@prisma/client';
import type { WearablePlatformAdapter } from '../platform-adapter.interface';
import { MockAdapter } from '../mock.adapter';
import { AbbottLibreAdapter } from './medical/abbott-libre.adapter';
import { DexcomAdapter } from './medical/dexcom.adapter';
import { WithingsAdapter } from './medical/withings.adapter';
import { OmronAdapter } from './medical/omron.adapter';
import { MedtronicCgmAdapter } from './medical/medtronic-cgm.adapter';
import { MedtronicCardiacAdapter } from './medical/medtronic-cardiac.adapter';
import { AbbottCardiacAdapter } from './medical/abbott-cardiac.adapter';
import { BscLatitudeAdapter } from './medical/bsc-latitude.adapter';
import { AlivecorAdapter } from './medical/alivecor.adapter';

@Injectable()
export class AdapterRegistry {
  private readonly live = new Map<WearablePlatform, WearablePlatformAdapter>();

  constructor(
    private readonly mock: MockAdapter,
    private readonly config: ConfigService,
    abbottLibre: AbbottLibreAdapter,
    dexcom: DexcomAdapter,
    withings: WithingsAdapter,
    omron: OmronAdapter,
    medtronicCgm: MedtronicCgmAdapter,
    medtronicCardiac: MedtronicCardiacAdapter,
    abbottCardiac: AbbottCardiacAdapter,
    bscLatitude: BscLatitudeAdapter,
    alivecor: AlivecorAdapter,
  ) {
    this.live.set(WearablePlatform.abbott_libre, abbottLibre);
    this.live.set(WearablePlatform.dexcom, dexcom);
    this.live.set(WearablePlatform.withings, withings);
    this.live.set(WearablePlatform.omron, omron);
    this.live.set(WearablePlatform.medtronic_cgm, medtronicCgm);
    this.live.set(WearablePlatform.medtronic_cardiac, medtronicCardiac);
    this.live.set(WearablePlatform.abbott_cardiac, abbottCardiac);
    this.live.set(WearablePlatform.boston_scientific, bscLatitude);
    this.live.set(WearablePlatform.alivecor, alivecor);
  }

  /** Register a consumer adapter (called by W3's ConsumerAdaptersModule). */
  register(platform: WearablePlatform, adapter: WearablePlatformAdapter): void {
    this.live.set(platform, adapter);
  }

  getAdapter(platform: WearablePlatform): WearablePlatformAdapter {
    if (this.config.get<string>('WEARABLES_PROVIDER') === 'mock') {
      return this.mock;
    }
    const adapter = this.live.get(platform);
    if (!adapter) {
      throw new Error(`No adapter registered for platform: ${platform}`);
    }
    return adapter;
  }
}
