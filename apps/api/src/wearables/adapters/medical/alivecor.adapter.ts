/**
 * AliveCor KardiaMobile — manual upload, not partnership.
 *
 * No public OAuth API for individual patients. A clinician uploads the PDF ECG
 * recording via POST /api/wearables/upload/kardia (scaffolded, returns 501 until
 * a KardiaPro Enterprise agreement is signed). The adapter itself never starts an
 * OAuth flow.
 */
import { Injectable } from '@nestjs/common';
import type { WearableDevice } from '@prisma/client';
import type { RawReading, TokenSet, WearablePlatformAdapter } from '../../platform-adapter.interface';
import { WearablesStubError } from '../../platform-catalog';

@Injectable()
export class AlivecorAdapter implements WearablePlatformAdapter {
  getAuthUrl(_patientId: string, _state: string): string {
    throw new WearablesStubError({ error: 'MANUAL_UPLOAD_REQUIRED', platform: 'alivecor' });
  }
  async exchangeCode(_code: string, _state: string): Promise<TokenSet> {
    throw new WearablesStubError({ error: 'MANUAL_UPLOAD_REQUIRED', platform: 'alivecor' });
  }
  async syncReadings(_device: WearableDevice, _from: Date): Promise<RawReading[]> {
    return [];
  }
  async refreshToken(_device: WearableDevice): Promise<TokenSet> {
    throw new WearablesStubError({ error: 'MANUAL_UPLOAD_REQUIRED', platform: 'alivecor' });
  }
  async revokeToken(_device: WearableDevice): Promise<void> {
    /* no token to revoke */
  }
}
