/**
 * Apple Health — iOS-companion-app required (no web OAuth path). The adapter
 * never starts an OAuth flow; readings would arrive via POST /api/wearables/upload/apple
 * once the native app ships (scaffolded, 501). No SwiftUI here — separate deliverable.
 */
import { Injectable } from '@nestjs/common';
import type { WearableDevice } from '@prisma/client';
import type { RawReading, TokenSet, WearablePlatformAdapter } from '../../platform-adapter.interface';
import { WearablesStubError } from '../../platform-catalog';

@Injectable()
export class AppleHealthAdapter implements WearablePlatformAdapter {
  getAuthUrl(_patientId: string, _state: string): string {
    throw new WearablesStubError({ error: 'IOS_APP_REQUIRED', appStoreUrl: null });
  }
  async exchangeCode(_code: string, _state: string): Promise<TokenSet> {
    throw new WearablesStubError({ error: 'IOS_APP_REQUIRED' });
  }
  async syncReadings(_device: WearableDevice, _from: Date): Promise<RawReading[]> {
    return [];
  }
  async refreshToken(_device: WearableDevice): Promise<TokenSet> {
    throw new WearablesStubError({ error: 'IOS_APP_REQUIRED' });
  }
  async revokeToken(_device: WearableDevice): Promise<void> {
    /* no token to revoke */
  }
}
