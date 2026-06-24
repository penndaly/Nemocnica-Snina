/**
 * Huawei Health Kit — BLOCKED until the EU Adequacy Decision for China is adopted
 * (Decree 179/2020 + DPIA_WEARABLES_ADDENDUM.md + WL9 Part D config validator).
 * This adapter MUST NOT contain working OAuth endpoints. partnershipRequired=true
 * in platform-catalog.ts controls UI gating.
 */
import { Injectable } from '@nestjs/common';
import type { WearableDevice } from '@prisma/client';
import type { RawReading, TokenSet, WearablePlatformAdapter } from '../../platform-adapter.interface';
import { WearablesBlockedError } from '../../platform-catalog';

const BLOCK = {
  error: 'HUAWEI_BLOCKED_EU_ADEQUACY',
  message: 'Huawei Health Kit is blocked pending the EU Adequacy Decision for China. See DPIA_WEARABLES_ADDENDUM.md.',
};

@Injectable()
export class HuaweiAdapter implements WearablePlatformAdapter {
  getAuthUrl(_patientId: string, _state: string): string {
    throw new WearablesBlockedError(BLOCK);
  }
  async exchangeCode(_code: string, _state: string): Promise<TokenSet> {
    throw new WearablesBlockedError(BLOCK);
  }
  async syncReadings(_device: WearableDevice, _from: Date): Promise<RawReading[]> {
    return [];
  }
  async refreshToken(_device: WearableDevice): Promise<TokenSet> {
    throw new WearablesBlockedError(BLOCK);
  }
  async revokeToken(_device: WearableDevice): Promise<void> {
    /* no token issued */
  }
}
