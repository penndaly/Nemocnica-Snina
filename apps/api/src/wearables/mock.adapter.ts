/**
 * Mock platform adapter — used when WEARABLES_PROVIDER=mock (dev/CI default).
 *
 * Returns static fixture data matching the shape of
 * assets/wearables-demo-data.js (the portal prototype). No external HTTP.
 */
import { Injectable } from '@nestjs/common';
import type { WearableDevice } from '@prisma/client';
import type { RawReading, TokenSet, WearablePlatformAdapter } from './platform-adapter.interface';

@Injectable()
export class MockAdapter implements WearablePlatformAdapter {
  getAuthUrl(patientId: string, state: string): string {
    // Loops straight back to the callback in mock mode — no real provider.
    return `http://localhost:4000/api/wearables/callback/mock?state=${encodeURIComponent(state)}&code=mock-code&patient=${encodeURIComponent(patientId)}`;
  }

  exchangeCode(_code: string, _state: string): Promise<TokenSet> {
    return Promise.resolve({
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
      expiresAt: new Date(Date.now() + 3600_000),
    });
  }

  syncReadings(_device: WearableDevice, _from: Date): Promise<RawReading[]> {
    const now = Date.now();
    return Promise.resolve([
      {
        metricType: '14745-4', // Glucose [Moles/volume]
        metricLabel: { sk: 'Glukóza', en: 'Glucose' },
        valueNumeric: 5.8,
        unit: 'mmol/l',
        flag: 'normal',
        recordedAt: new Date(now - 5 * 60_000),
      },
      {
        metricType: '8867-4', // Heart rate
        metricLabel: { sk: 'Tepová frekvencia', en: 'Heart rate' },
        valueNumeric: 72,
        unit: 'bpm',
        flag: 'normal',
        recordedAt: new Date(now - 12 * 60_000),
      },
    ]);
  }

  revokeToken(_device: WearableDevice): Promise<void> {
    return Promise.resolve();
  }
}
