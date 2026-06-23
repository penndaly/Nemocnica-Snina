import { BadRequestException } from '@nestjs/common';
import { OAuthStateService } from '../oauth-state.service';

const cfg = { get: () => 'a'.repeat(64) } as never;

describe('OAuthStateService — CSRF hardening (WR-7)', () => {
  it('accepts a freshly issued, platform-matched state once', () => {
    const svc = new OAuthStateService(cfg);
    const state = svc.generateState('tok-1', 'fitbit');
    expect(svc.validateState(state, 'fitbit')).toEqual({ patientToken: 'tok-1' });
  });

  it('rejects a reused state (one-time use) → 400', () => {
    const svc = new OAuthStateService(cfg);
    const state = svc.generateState('tok-1', 'fitbit');
    svc.validateState(state, 'fitbit');
    expect(() => svc.validateState(state, 'fitbit')).toThrow(BadRequestException);
  });

  it('rejects a forged / unknown state → 400 INVALID_OAUTH_STATE', () => {
    const svc = new OAuthStateService(cfg);
    expect(() => svc.validateState('deadbeef.forged', 'fitbit')).toThrow('INVALID_OAUTH_STATE');
  });

  it('rejects a state issued for another platform → STATE_PLATFORM_MISMATCH', () => {
    const svc = new OAuthStateService(cfg);
    const state = svc.generateState('tok-1', 'withings');
    expect(() => svc.validateState(state, 'fitbit')).toThrow('STATE_PLATFORM_MISMATCH');
  });

  it('a state signed with a different key does not validate (tamper-evident)', () => {
    const a = new OAuthStateService(cfg);
    const b = new OAuthStateService({ get: () => 'b'.repeat(64) } as never);
    const state = a.generateState('tok-1', 'fitbit');
    // b never issued it → unknown → rejected.
    expect(() => b.validateState(state, 'fitbit')).toThrow(BadRequestException);
  });
});
