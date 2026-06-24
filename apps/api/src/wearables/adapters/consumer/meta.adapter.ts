/**
 * Meta Ray-Ban — partnership required (Meta Wellbeing API; activity only, no
 * biometrics). No OAuth flow until a Meta Business partnership is signed.
 */
import { Injectable } from '@nestjs/common';
import { WearablePlatform, type WearableDevice } from '@prisma/client';
import type { RawReading, TokenSet, WearablePlatformAdapter } from '../../platform-adapter.interface';
import { BadRequestPartnership } from '../../platform-catalog';

@Injectable()
export class MetaAdapter implements WearablePlatformAdapter {
  getAuthUrl(_patientId: string, _state: string): string {
    throw new BadRequestPartnership(WearablePlatform.meta);
  }
  async exchangeCode(_code: string, _state: string): Promise<TokenSet> {
    throw new BadRequestPartnership(WearablePlatform.meta);
  }
  async syncReadings(_device: WearableDevice, _from: Date): Promise<RawReading[]> {
    return [];
  }
  async refreshToken(_device: WearableDevice): Promise<TokenSet> {
    throw new BadRequestPartnership(WearablePlatform.meta);
  }
  async revokeToken(_device: WearableDevice): Promise<void> {
    /* no token to revoke */
  }
}
