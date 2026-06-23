import { WearablesService } from '../wearables.service';
import { OAuthStateService } from '../oauth-state.service';

function makeService(refresh: { ok: boolean }) {
  const update = jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'd1', patientToken: 'tok', ...data }));
  const notify = jest.fn().mockResolvedValue({});
  const prisma = {
    wearableDevice: { update },
    portalNotification: { create: notify },
  } as never;
  const crypto = { encryptToken: jest.fn((s: string) => `enc:${s}`) } as never;
  const cfg = { get: jest.fn(() => undefined) } as never;
  const adapter = {
    refreshToken: refresh.ok
      ? jest.fn().mockResolvedValue({ accessToken: 'new-a', refreshToken: 'new-r', expiresAt: new Date(Date.now() + 3600_000) })
      : jest.fn().mockRejectedValue(new Error('refresh denied')),
  } as never;
  const audit = { log: jest.fn() } as never;
  const svc = new WearablesService(prisma, audit, {} as never, crypto, new OAuthStateService(cfg), cfg, {} as never, { publish: jest.fn() } as never, adapter);
  return { svc, update, notify, crypto };
}

const device = (over: Record<string, unknown> = {}) => ({
  id: 'd1', patientToken: 'tok', oauthAccessTokenEnc: 'enc:old', oauthRefreshTokenEnc: 'enc:oldr',
  oauthExpiresAt: new Date(Date.now() + 60_000), // expires in 1 min → within 5-min window
  ...over,
}) as never;

describe('WearablesService.refreshTokenIfNeeded (W6 rotation)', () => {
  it('no-ops when the token is not near expiry', async () => {
    const { svc, update } = makeService({ ok: true });
    const d = device({ oauthExpiresAt: new Date(Date.now() + 3600_000) });
    await expect(svc.refreshTokenIfNeeded(d)).resolves.toBe(d);
    expect(update).not.toHaveBeenCalled();
  });

  it('no-ops for a mock-seeded device with no token expiry', async () => {
    const { svc, update } = makeService({ ok: true });
    const d = device({ oauthExpiresAt: null });
    await expect(svc.refreshTokenIfNeeded(d)).resolves.toBe(d);
    expect(update).not.toHaveBeenCalled();
  });

  it('refreshes + re-encrypts when expiring soon', async () => {
    const { svc, update, crypto } = makeService({ ok: true });
    const result = await svc.refreshTokenIfNeeded(device());
    expect(result).not.toBeNull();
    expect((crypto as unknown as { encryptToken: jest.Mock }).encryptToken).toHaveBeenCalledWith('new-a');
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ oauthAccessTokenEnc: 'enc:new-a' }),
    }));
  });

  it('on refresh failure → returns null, marks error, raises a token-expired notification (no SMS)', async () => {
    const { svc, update, notify } = makeService({ ok: false });
    const result = await svc.refreshTokenIfNeeded(device());
    expect(result).toBeNull();
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ syncStatus: 'error', syncError: 'token_refresh_failed' }) }));
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ type: 'wearable_token_expired' }) }));
  });
});
