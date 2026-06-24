/**
 * Wearables Redis KV store (Sprint WL9) — the distributed backing for two
 * pieces of state that MUST be shared across all API instances:
 *
 *   • OAuth connect state (Part A) — one-time-use CSRF tokens. A token created
 *     on instance A must be consumable exactly once on instance B. GETDEL makes
 *     consume atomic, so a replay across instances cannot both succeed.
 *   • Batch-alert digest windows (Part B) — accumulate non-critical alerts per
 *     physician per 15-minute window, then flush a single digest. The window
 *     list + a "pending" set survive restarts, which a setTimeout/BullMQ-less
 *     in-process timer cannot.
 *
 * Unlike StaffSecurityRedis, this store does NOT fall back to in-memory: OAuth
 * one-time-use is a security guarantee that an in-memory map silently breaks in
 * a multi-instance deployment. When Redis is unconfigured/unreachable the OAuth
 * methods throw 503 (per WL9 Part A). The digest is a convenience and degrades
 * gracefully — callers check `available()` first.
 *
 * Keys:
 *   wearables:oauth_state:{nonce}            → AES-256-GCM(payload), EX 900
 *   wearables:alert_digest:{window}:{phys}   → RPUSH list of alert JSON, EX ~20m
 *   wearables:alert_digest:pending           → SET of "{window}:{phys}" members
 */
import { Injectable, Logger, OnModuleDestroy, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

const STATE_PREFIX = 'wearables:oauth_state:';
const DIGEST_PREFIX = 'wearables:alert_digest:';
const DIGEST_PENDING = 'wearables:alert_digest:pending';

/**
 * The subset of operations the OAuth-state and digest code needs. Backed by
 * Redis in the wired app; an in-memory implementation is used in unit tests.
 */
export interface WearablesKv {
  /** Whether a usable backing store is present. */
  available(): boolean;

  // ── OAuth state (one-time use) ──────────────────────────
  /** Store a state value under `token` with a TTL (seconds). Throws 503 if unavailable. */
  putState(token: string, value: string, ttlSec: number): Promise<void>;
  /** Atomically read-and-delete a state value (one-time use). Null if absent/expired. Throws 503 if unavailable. */
  takeState(token: string): Promise<string | null>;

  // ── Batch-alert digest windows ──────────────────────────
  /** Append an alert to a window's list; returns the new list length (1 = first in window). */
  digestAppend(member: string, item: string, ttlSec: number): Promise<number>;
  /** All pending digest window members (`"{window}:{physicianId}"`). */
  digestPendingMembers(): Promise<string[]>;
  /** Atomically drain (read + delete) a window's accumulated alerts. */
  digestDrain(member: string): Promise<string[]>;
}

/** DI token so consumers depend on the interface, not the concrete Redis service. */
export const WEARABLES_KV = Symbol('WEARABLES_KV');

@Injectable()
export class WearablesRedisService implements WearablesKv, OnModuleDestroy {
  private readonly logger = new Logger(WearablesRedisService.name);
  private redis: Redis | null = null;

  constructor(cfg: ConfigService) {
    const url = cfg.get<string>('REDIS_URL');
    if (url) {
      try {
        this.redis = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 2, enableOfflineQueue: false });
        this.redis.on('error', (e) => this.logger.warn(`Redis error: ${e.message}`));
        void this.redis.connect().catch(() => {
          this.logger.error('Redis connect failed — wearables OAuth state will return 503 until Redis is reachable');
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

  available(): boolean {
    return !!this.redis;
  }

  /** Returns the client or throws 503 — never falls back to in-memory. */
  private client(): Redis {
    if (!this.redis) {
      throw new ServiceUnavailableException('WEARABLES_REDIS_UNAVAILABLE');
    }
    return this.redis;
  }

  // ── OAuth state ─────────────────────────────────────────

  async putState(token: string, value: string, ttlSec: number): Promise<void> {
    await this.client().set(STATE_PREFIX + token, value, 'EX', Math.max(1, Math.floor(ttlSec)));
  }

  async takeState(token: string): Promise<string | null> {
    // GETDEL (Redis 6.2+) is atomic — read and delete in one round trip so a
    // concurrent replay on another instance cannot also read the value.
    return this.client().getdel(STATE_PREFIX + token);
  }

  // ── Batch-alert digest windows ──────────────────────────

  async digestAppend(member: string, item: string, ttlSec: number): Promise<number> {
    const c = this.client();
    const key = DIGEST_PREFIX + member;
    const len = await c.rpush(key, item);
    if (len === 1) {
      // First alert in this window — set the TTL (window + grace) and mark pending.
      await c.expire(key, Math.max(1, Math.floor(ttlSec)));
    }
    await c.sadd(DIGEST_PENDING, member);
    return len;
  }

  async digestPendingMembers(): Promise<string[]> {
    return this.client().smembers(DIGEST_PENDING);
  }

  async digestDrain(member: string): Promise<string[]> {
    const c = this.client();
    const key = DIGEST_PREFIX + member;
    const items = await c.lrange(key, 0, -1);
    await c.del(key);
    await c.srem(DIGEST_PENDING, member);
    return items;
  }
}

/**
 * In-memory WearablesKv for unit tests and single-process dev only. NOT wired
 * into the module — the production provider is always WearablesRedisService so
 * the one-time-use guarantee holds across instances. Exported for tests that
 * exercise OAuthStateService / WearablesDigestService without infra.
 */
export class InMemoryWearablesKv implements WearablesKv {
  private readonly state = new Map<string, { value: string; expiresAt: number }>();
  private readonly lists = new Map<string, string[]>();
  private readonly pending = new Set<string>();

  available(): boolean {
    return true;
  }

  async putState(token: string, value: string, ttlSec: number): Promise<void> {
    this.state.set(token, { value, expiresAt: Date.now() + ttlSec * 1000 });
  }

  async takeState(token: string): Promise<string | null> {
    const e = this.state.get(token);
    this.state.delete(token); // one-time use: delete on read regardless
    if (!e || e.expiresAt < Date.now()) return null;
    return e.value;
  }

  async digestAppend(member: string, item: string, _ttlSec: number): Promise<number> {
    const arr = this.lists.get(member) ?? [];
    arr.push(item);
    this.lists.set(member, arr);
    this.pending.add(member);
    return arr.length;
  }

  async digestPendingMembers(): Promise<string[]> {
    return [...this.pending];
  }

  async digestDrain(member: string): Promise<string[]> {
    const arr = this.lists.get(member) ?? [];
    this.lists.delete(member);
    this.pending.delete(member);
    return arr;
  }
}
