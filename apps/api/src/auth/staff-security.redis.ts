/**
 * Staff security state in Redis — JWT revocation blacklist + sliding-window
 * rate limits (login failures, invite/reset emails).
 *
 * Graceful degradation: if REDIS_URL is unset or Redis is unreachable, an
 * in-memory Map is used (per the APS/booking pattern). That keeps dev/CI and
 * unit tests working without infra; production always has Redis.
 *
 * Keys:
 *   staff:blacklist:{jti}          → "1"  (TTL = remaining token lifetime)
 *   staff:loginfail:{email}        → counter (TTL 1h)
 *   staff:emailrate:{email}        → counter (TTL 1h)
 */
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

interface MemEntry {
  value: number;
  expiresAt: number;
}

@Injectable()
export class StaffSecurityRedis implements OnModuleDestroy {
  private readonly logger = new Logger(StaffSecurityRedis.name);
  private redis: Redis | null = null;
  private readonly mem = new Map<string, MemEntry>();

  constructor(cfg: ConfigService) {
    const url = cfg.get<string>('REDIS_URL');
    if (url) {
      try {
        this.redis = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 1, enableOfflineQueue: false });
        this.redis.on('error', (e) => this.logger.warn(`Redis error (using in-memory fallback): ${e.message}`));
        void this.redis.connect().catch(() => {
          this.logger.warn('Redis connect failed — staff security state will use in-memory fallback');
          this.redis = null;
        });
      } catch {
        this.redis = null;
      }
    }
  }

  onModuleDestroy() {
    this.redis?.disconnect();
  }

  // ── in-memory helpers ───────────────────────────────────
  private memGet(key: string): number {
    const e = this.mem.get(key);
    if (!e) return 0;
    if (e.expiresAt < Date.now()) {
      this.mem.delete(key);
      return 0;
    }
    return e.value;
  }

  private memIncr(key: string, ttlSec: number): number {
    const cur = this.memGet(key);
    const next = cur + 1;
    const existing = this.mem.get(key);
    const expiresAt = existing && existing.expiresAt > Date.now() ? existing.expiresAt : Date.now() + ttlSec * 1000;
    this.mem.set(key, { value: next, expiresAt });
    return next;
  }

  // ── JWT revocation blacklist ────────────────────────────

  async blacklistJti(jti: string, ttlSeconds: number): Promise<void> {
    const ttl = Math.max(1, Math.floor(ttlSeconds));
    if (this.redis) {
      try {
        await this.redis.set(`staff:blacklist:${jti}`, '1', 'EX', ttl);
        return;
      } catch {
        /* fall through */
      }
    }
    this.mem.set(`staff:blacklist:${jti}`, { value: 1, expiresAt: Date.now() + ttl * 1000 });
  }

  async isBlacklisted(jti: string): Promise<boolean> {
    if (this.redis) {
      try {
        return (await this.redis.exists(`staff:blacklist:${jti}`)) === 1;
      } catch {
        /* fall through */
      }
    }
    return this.memGet(`staff:blacklist:${jti}`) > 0;
  }

  // ── sliding-window counters (1-hour window) ─────────────

  private async incr(key: string): Promise<number> {
    const ttl = 3600;
    if (this.redis) {
      try {
        const n = await this.redis.incr(key);
        if (n === 1) await this.redis.expire(key, ttl);
        return n;
      } catch {
        /* fall through */
      }
    }
    return this.memIncr(key, ttl);
  }

  /** Increment failed-login counter for an email; returns the new count. */
  incrLoginFailure(email: string): Promise<number> {
    return this.incr(`staff:loginfail:${email.toLowerCase()}`);
  }

  async resetLoginFailures(email: string): Promise<void> {
    const key = `staff:loginfail:${email.toLowerCase()}`;
    if (this.redis) {
      try {
        await this.redis.del(key);
        return;
      } catch {
        /* fall through */
      }
    }
    this.mem.delete(key);
  }

  /** Increment email-send counter for an address; returns the new count. */
  incrEmailSend(email: string): Promise<number> {
    return this.incr(`staff:emailrate:${email.toLowerCase()}`);
  }
}
