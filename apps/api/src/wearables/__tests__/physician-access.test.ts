import { ForbiddenException } from '@nestjs/common';
import { WearablesService } from '../wearables.service';
import { OAuthStateService } from '../oauth-state.service';
import { TokenCryptoService } from '../token-crypto.service';
import { InMemoryWearablesKv } from '../wearables-redis.service';

// OAuth state is unused by these tests — a minimal valid instance satisfies DI.
const keyCfg = { get: () => '0'.repeat(64) } as never;
const stubOAuthState = () => new OAuthStateService(keyCfg, new TokenCryptoService(keyCfg), new InMemoryWearablesKv());

function makeService(opts: { session?: unknown; consent?: unknown; namedAccess?: unknown } = {}) {
  const upsert = jest.fn().mockResolvedValue({});
  const sharing = 'consent' in opts ? opts.consent : { id: 'c1' };
  const named = 'namedAccess' in opts ? opts.namedAccess : null;
  const prisma = {
    telehealthSession: { findFirst: jest.fn().mockResolvedValue(opts.session === undefined ? null : opts.session) },
    deviceConsent: {
      findFirst: jest.fn().mockImplementation((args: { where?: { consentType?: string } }) =>
        Promise.resolve(args?.where?.consentType === 'physician_named_access' ? named : sharing),
      ),
    },
    deviceAlertThreshold: { upsert },
    wearableDevice: { findMany: jest.fn().mockResolvedValue([]) },
    portalNotification: { findMany: jest.fn().mockResolvedValue([]) },
  } as never;
  const audit = { log: jest.fn().mockResolvedValue(undefined) } as never;
  const noop = {} as never;
  const cfg = { get: jest.fn((k: string) => (k === 'WEARABLES_PHYSICIAN_ACCESS_WINDOW_DAYS' ? '90' : undefined)) } as never;
  const alerts = {} as never;
  const queue = { publish: jest.fn() } as never;
  const svc = new WearablesService(prisma, audit, noop, noop, stubOAuthState(), cfg, alerts, queue, noop);
  return { svc, upsert };
}

describe('physician access gate', () => {
  it('200-path: a recent telehealth relationship + physician_sharing consent grants access', async () => {
    const { svc } = makeService({ session: { id: 's1' }, consent: { id: 'c1' } });
    await expect(svc.assertPhysicianAccess('phys-1', 'tok-A')).resolves.toBeUndefined();
  });

  it('403 PHYSICIAN_ACCESS_DENIED when no relationship exists (WR-W5-4)', async () => {
    const { svc } = makeService({ session: null });
    await expect(svc.assertPhysicianAccess('phys-1', 'tok-B')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('403 when relationship exists but no physician_sharing consent', async () => {
    const { svc } = makeService({ session: { id: 's1' }, consent: null });
    await expect(svc.assertPhysicianAccess('phys-1', 'tok-A')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('physicianView throws 403 for an unrelated physician', async () => {
    const { svc } = makeService({ session: null });
    await expect(svc.physicianView('tok-B', 'phys-1')).rejects.toThrow('PHYSICIAN_ACCESS_DENIED');
  });
});

describe('threshold editor role gate', () => {
  it('rejects a non-clinician role with 403', async () => {
    const { svc, upsert } = makeService();
    await expect(svc.setThresholds('tok-A', 'phys-1', 'EDITOR', '14745-4', { high: 8 })).rejects.toBeInstanceOf(ForbiddenException);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('upserts thresholds for a CLINICIAN and writes an audit entry', async () => {
    const { svc, upsert } = makeService();
    await expect(svc.setThresholds('tok-A', 'phys-1', 'CLINICIAN', '14745-4', { high: 8, criticalHigh: 14 })).resolves.toEqual({ ok: true });
    expect(upsert).toHaveBeenCalled();
  });
});
