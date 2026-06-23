import { BadRequestException, NotFoundException } from '@nestjs/common';
import { WearablesService } from '../wearables.service';
import { OAuthStateService } from '../oauth-state.service';

function makeService(provider = 'mock') {
  const prisma = {
    wearableDevice: {
      count: jest.fn().mockResolvedValue(1),
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'dev-1',
          patientToken: 'tok-1',
          platform: 'abbott_libre',
          deviceLabel: 'Abbott FreeStyle Libre 3 / 2+',
          category: 'medical',
          deviceType: 'cgm',
          shareWithPhysician: true,
          partnershipRequired: false,
          syncStatus: 'ok',
          lastSyncAt: new Date(),
          disconnectedAt: null,
          connectedAt: new Date(),
          readings: [],
        },
      ]),
      findFirst: jest.fn(),
    },
  } as never;

  const audit = { log: jest.fn().mockResolvedValue(undefined) } as never;
  const consent = {
    grantConsent: jest.fn().mockResolvedValue(undefined),
    setConsent: jest.fn().mockResolvedValue(undefined),
    withdrawConsent: jest.fn().mockResolvedValue(undefined),
  } as never;
  const crypto = { encryptToken: jest.fn((s: string) => `enc:${s}`) } as never;
  const oauthState = new OAuthStateService({ get: () => '0'.repeat(64) } as never);
  const cfg = {
    get: jest.fn((k: string) =>
      k === 'WEARABLES_PROVIDER' ? provider : k === 'WEARABLES_OAUTH_REDIRECT_BASE' ? 'http://localhost:4000' : undefined,
    ),
  } as never;
  const adapter = {
    getAuthUrl: jest.fn(() => 'https://live.example/oauth'),
    exchangeCode: jest.fn(),
    syncReadings: jest.fn().mockResolvedValue([]),
    revokeToken: jest.fn(),
  } as never;
  const alerts = {
    processReading: jest.fn().mockResolvedValue({ flag: 'normal', exceeded: null }),
    evaluateReading: jest.fn().mockResolvedValue({ flag: 'normal', exceeded: null }),
  } as never;
  const queue = { publish: jest.fn().mockResolvedValue(undefined) } as never;

  const svc = new WearablesService(prisma, audit, consent, crypto, oauthState, cfg, alerts, queue, adapter);
  return { svc, prisma, consent };
}

describe('WearablesService.connect (platform gating)', () => {
  it('rejects partnership-gated platforms with partnership_required', () => {
    const { svc } = makeService();
    try {
      svc.connect('tok-1', 'medtronic_cardiac');
      fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(BadRequestException);
      expect((e as BadRequestException).getResponse()).toMatchObject({ code: 'partnership_required' });
    }
  });

  it('rejects manual-upload-only platforms', () => {
    const { svc } = makeService();
    expect(() => svc.connect('tok-1', 'alivecor')).toThrow(BadRequestException);
  });

  it('rejects Apple Health (iOS app required)', () => {
    const { svc } = makeService();
    try {
      svc.connect('tok-1', 'apple_health');
      fail('should have thrown');
    } catch (e) {
      expect((e as BadRequestException).getResponse()).toMatchObject({ code: 'IOS_APP_REQUIRED' });
    }
  });

  it('rejects unknown platforms', () => {
    const { svc } = makeService();
    expect(() => svc.connect('tok-1', 'nokia_3310')).toThrow(NotFoundException);
  });

  it('returns a mock callback authUrl for a standard platform in mock mode', () => {
    const { svc } = makeService('mock');
    const { authUrl } = svc.connect('tok-1', 'fitbit');
    expect(authUrl).toContain('/api/wearables/callback/fitbit');
    expect(authUrl).toContain('state=');
  });

  it('uses the live adapter authUrl when provider=live', () => {
    const { svc } = makeService('live');
    const { authUrl } = svc.connect('tok-1', 'fitbit');
    expect(authUrl).toBe('https://live.example/oauth');
  });
});

describe('WearablesService.listDevices', () => {
  it('maps devices and includes the available-platform catalogue', async () => {
    const { svc } = makeService();
    const res = await svc.listDevices('tok-1');
    expect(res.devices).toHaveLength(1);
    expect(res.devices[0]).toMatchObject({ brand: 'Abbott', category: 'medical', deviceType: 'cgm' });
    expect(res.available.length).toBeGreaterThan(10);
    expect(res.available.find((p) => p.platform === 'meta')?.partnershipRequired).toBe(true);
  });
});

describe('WearablesService.updateConsent', () => {
  it('delegates to ConsentService.setConsent and returns current consent', async () => {
    const { svc, prisma, consent } = makeService();
    (prisma as unknown as { wearableDevice: { findFirst: jest.Mock } }).wearableDevice.findFirst.mockResolvedValue({
      id: 'dev-1', patientToken: 'tok-1', shareWithPhysician: false,
    });
    (prisma as unknown as { deviceConsent?: unknown }).deviceConsent = {
      findMany: jest.fn().mockResolvedValue([]),
    };
    await svc.updateConsent('tok-1', 'dev-1', { type: 'physician_sharing', granted: true }, 'iphash');
    expect((consent as unknown as { setConsent: jest.Mock }).setConsent).toHaveBeenCalledWith(
      'tok-1', 'dev-1', 'physician_sharing', true, 'iphash',
    );
  });
});
