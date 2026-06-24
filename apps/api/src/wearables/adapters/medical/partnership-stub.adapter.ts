/**
 * Base for partnership-gated platform adapters (cardiac implants).
 *
 * These platforms require a signed vendor agreement before any OAuth flow. Each
 * implements all five interface methods so DI resolves, but getAuthUrl /
 * exchangeCode / refreshToken throw the canonical BadRequestPartnership from the
 * catalog, and syncReadings returns [] (no throw). No tokens are ever issued, so
 * revokeToken is a no-op.
 */
import type { WearableDevice } from '@prisma/client';
import { WearablePlatform } from '@prisma/client';
import type { RawReading, TokenSet, WearablePlatformAdapter } from '../../platform-adapter.interface';
import { BadRequestPartnership } from '../../platform-catalog';

export abstract class PartnershipStubAdapter implements WearablePlatformAdapter {
  protected abstract readonly platform: WearablePlatform;

  getAuthUrl(_patientId: string, _state: string): string {
    throw new BadRequestPartnership(this.platform);
  }
  async exchangeCode(_code: string, _state: string): Promise<TokenSet> {
    throw new BadRequestPartnership(this.platform);
  }
  async syncReadings(_device: WearableDevice, _from: Date): Promise<RawReading[]> {
    return [];
  }
  async refreshToken(_device: WearableDevice): Promise<TokenSet> {
    throw new BadRequestPartnership(this.platform);
  }
  async revokeToken(_device: WearableDevice): Promise<void> {
    /* no token to revoke */
  }
}
