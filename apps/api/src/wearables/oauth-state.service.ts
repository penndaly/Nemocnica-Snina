/**
 * OAuth state issuer for the wearables connect flow — CSRF protection (W6-hardened).
 *
 * A state is `nonce.hmac` where hmac = HMAC-SHA256(nonce:patientToken:platform,
 * WEARABLES_TOKEN_KEY). The signature makes a state unforgeable without the
 * server key; an authoritative one-time, TTL'd, platform-bound entry is also held
 * so replay/expiry/platform-mismatch are rejected. (Production scale-out: back the
 * entry store with Redis — the generate/validate contract is unchanged.)
 *
 * validateState rejects with 400:
 *   • forged / unknown / tampered state → INVALID_OAUTH_STATE
 *   • reused (already consumed) state   → INVALID_OAUTH_STATE
 *   • expired state                     → INVALID_OAUTH_STATE
 *   • state issued for another platform → STATE_PLATFORM_MISMATCH
 */
import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

interface StateEntry {
  patientToken: string;
  platform: string;
  expiresAt: number;
}

const TTL_MS = 15 * 60 * 1000; // 15 minutes

@Injectable()
export class OAuthStateService {
  private readonly store = new Map<string, StateEntry>();
  private readonly key: string;

  constructor(cfg: ConfigService) {
    this.key = cfg.get<string>('WEARABLES_TOKEN_KEY') ?? '0'.repeat(64);
  }

  private sign(nonce: string, patientToken: string, platform: string): string {
    return createHmac('sha256', this.key).update(`${nonce}:${patientToken}:${platform}`).digest('hex');
  }

  generateState(patientToken: string, platform: string): string {
    this.sweep();
    const nonce = randomBytes(16).toString('hex');
    const state = `${nonce}.${this.sign(nonce, patientToken, platform)}`;
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
    // Re-verify the signature (defence in depth — guards a tampered store key).
    const [nonce, sig] = state.split('.');
    const expected = this.sign(nonce ?? '', entry.patientToken, entry.platform);
    if (!sig || !this.safeEqual(sig, expected)) {
      this.store.delete(state);
      throw new BadRequestException('INVALID_OAUTH_STATE');
    }
    this.store.delete(state);
    return { patientToken: entry.patientToken };
  }

  private safeEqual(a: string, b: string): boolean {
    const ab = Buffer.from(a);
    const bb = Buffer.from(b);
    return ab.length === bb.length && timingSafeEqual(ab, bb);
  }

  private sweep(): void {
    const now = Date.now();
    for (const [k, v] of this.store) {
      if (v.expiresAt < now) this.store.delete(k);
    }
  }
}
