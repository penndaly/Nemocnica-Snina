/**
 * Xiaomi / Mi Fitness — no public OAuth API. Integration is manual GDPR data
 * export: the patient uploads the export .zip via POST /api/wearables/upload/xiaomi
 * (see wearables.controller + xiaomi-csv.ts). The adapter never starts OAuth.
 */
import { Injectable } from '@nestjs/common';
import type { WearableDevice } from '@prisma/client';
import type { RawReading, TokenSet, WearablePlatformAdapter } from '../../platform-adapter.interface';
import { WearablesStubError } from '../../platform-catalog';

@Injectable()
export class XiaomiAdapter implements WearablePlatformAdapter {
  getAuthUrl(_patientId: string, _state: string): string {
    throw new WearablesStubError({ error: 'MANUAL_EXPORT_REQUIRED' });
  }
  async exchangeCode(_code: string, _state: string): Promise<TokenSet> {
    throw new WearablesStubError({ error: 'MANUAL_EXPORT_REQUIRED' });
  }
  async syncReadings(_device: WearableDevice, _from: Date): Promise<RawReading[]> {
    return [];
  }
  async refreshToken(_device: WearableDevice): Promise<TokenSet> {
    throw new WearablesStubError({ error: 'MANUAL_EXPORT_REQUIRED' });
  }
  async revokeToken(_device: WearableDevice): Promise<void> {
    /* no token to revoke */
  }
}
