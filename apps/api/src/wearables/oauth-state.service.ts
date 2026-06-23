/**
 * OAuth state issuer for the wearables connect flow (CSRF protection).
 *
 * Sprint W4 ships an in-memory, TTL'd, one-time-use store — enough for the mock
 * provider and dev. Sprint W6 hardens this to an HMAC-signed, Redis-backed store
 * (see SPRINT_W6 Part B); the generate/validate contract here is kept stable so
 * the swap is internal.
 */
import { BadRequestException, Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';

interface StateEntry {
  patientToken: string;
  platform: string;
  expiresAt: number;
}

const TTL_MS = 15 * 60 * 1000; // 15 minutes

@Injectable()
export class OAuthStateService {
  private readonly store = new Map<string, StateEntry>();

  generateState(patientToken: string, platform: string): string {
    this.sweep();
    const state = randomBytes(24).toString('hex');
    this.store.set(state, { patientToken, platform, expiresAt: Date.now() + TTL_MS });
    return state;
  }

  /** One-time use: a valid state is consumed (deleted) on validation. */
  validateState(state: string, expectedPlatform: string): { patientToken: string } {
    const entry = this.store.get(state);
    if (!entry || entry.expiresAt < Date.now()) {
      this.store.delete(state);
      throw new BadRequestException('INVALID_OAUTH_STATE');
    }
    if (entry.platform !== expectedPlatform) {
      throw new BadRequestException('STATE_PLATFORM_MISMATCH');
    }
    this.store.delete(state);
    return { patientToken: entry.patientToken };
  }

  private sweep(): void {
    const now = Date.now();
    for (const [k, v] of this.store) {
      if (v.expiresAt < now) this.store.delete(k);
    }
  }
}
