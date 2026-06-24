/**
 * OAuth state issuer for the wearables connect flow — CSRF protection,
 * Redis-backed (Sprint WL9 Part A).
 *
 * A state token is `nonce.hmac`, where hmac = HMAC-SHA256(nonce, WEARABLES_TOKEN_KEY).
 * The authoritative entry — `{ patientToken, platform, createdAt }`, AES-256-GCM
 * encrypted — is held in Redis under the nonce with a 15-minute TTL and is
 * deleted atomically on first consume (GETDEL). That makes the token:
 *   • unforgeable  — the HMAC needs the server key;
 *   • one-time     — consume deletes the entry across ALL API instances;
 *   • expiring     — Redis TTL;
 *   • platform-bound — the encrypted payload pins the platform.
 *
 * No in-memory fallback: if Redis is unavailable, putState/takeState throw 503
 * (WearablesRedisService). One-time-use cannot be guaranteed in-process across a
 * multi-instance deployment, so we fail closed rather than silently weaken CSRF.
 *
 * validateState rejects with 400:
 *   • forged / unknown / tampered / reused / expired → INVALID_OAUTH_STATE
 *   • state issued for another platform              → STATE_PLATFORM_MISMATCH
 */
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual, randomBytes } from 'crypto';
import { TokenCryptoService } from './token-crypto.service';
import { WEARABLES_KV, type WearablesKv } from './wearables-redis.service';

const TTL_SEC = 15 * 60; // 15 minutes

interface StatePayload {
  patientToken: string;
  platform: string;
  createdAt: number;
}

@Injectable()
export class OAuthStateService {
  private readonly key: string;

  constructor(
    cfg: ConfigService,
    private readonly crypto: TokenCryptoService,
    @Inject(WEARABLES_KV) private readonly kv: WearablesKv,
  ) {
    this.key = cfg.get<string>('WEARABLES_TOKEN_KEY') ?? '0'.repeat(64);
  }

  private sign(nonce: string): string {
    return createHmac('sha256', this.key).update(nonce).digest('hex');
  }

  /** Issue a signed, one-time, TTL'd state bound to this patient + platform. */
  async generateState(patientToken: string, platform: string): Promise<string> {
    const nonce = randomBytes(16).toString('hex');
    const payload: StatePayload = { patientToken, platform, createdAt: Date.now() };
    // Throws 503 if Redis is unavailable — fail closed (no in-memory fallback).
    await this.kv.putState(nonce, this.crypto.encryptToken(JSON.stringify(payload)), TTL_SEC);
    return `${nonce}.${this.sign(nonce)}`;
  }

  /** One-time use: a valid state is consumed (atomically deleted) on validation. */
  async consumeState(state: string, expectedPlatform: string): Promise<{ patientToken: string }> {
    const [nonce, sig] = (state ?? '').split('.');
    // Verify the HMAC before touching Redis — cheap rejection of obvious forgeries.
    if (!nonce || !sig || !this.safeEqual(sig, this.sign(nonce))) {
      throw new BadRequestException('INVALID_OAUTH_STATE');
    }

    const enc = await this.kv.takeState(nonce); // atomic GETDEL → one-time use
    if (!enc) {
      // Missing / expired / already consumed.
      throw new BadRequestException('INVALID_OAUTH_STATE');
    }

    let payload: StatePayload;
    try {
      payload = JSON.parse(this.crypto.decryptToken(enc)) as StatePayload;
    } catch {
      throw new BadRequestException('INVALID_OAUTH_STATE');
    }

    if (payload.platform !== expectedPlatform) {
      throw new BadRequestException('STATE_PLATFORM_MISMATCH');
    }
    return { patientToken: payload.patientToken };
  }

  private safeEqual(a: string, b: string): boolean {
    const ab = Buffer.from(a);
    const bb = Buffer.from(b);
    return ab.length === bb.length && timingSafeEqual(ab, bb);
  }
}
