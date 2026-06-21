/**
 * Ambulatory Emergency Service (APS) — live feed from e-VÚC / Prešov region (PSK).
 * PRODUCTION_ARCHITECTURE.md: "consume regional API to display live APS schedule;
 * cache with Redis TTL and fall back to CMS pages.aps text if feed unavailable."
 *
 * Feed format: PSK publishes APS schedules as structured JSON at their public API.
 * We cache each response in Redis (primary) or in-memory (fallback) for APS_CACHE_TTL_SECONDS
 * (default 600 s = 10 min) to control load.
 * On cache miss or error we return the static CMS fallback.
 *
 * Sprint S2: ioredis primary cache with TTL from env; graceful in-memory fallback.
 */
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export interface ApsEntry {
  date: string;       // YYYY-MM-DD
  from: string;       // HH:MM
  to: string;         // HH:MM
  facility: string;
  phone: string;
  address?: string;
  type: 'adult' | 'child' | 'dental';
}

export interface ApsResponse {
  source: 'live' | 'cache' | 'fallback';
  updatedAt: string;
  schedule: ApsEntry[];
  isFallback?: true;
}

// Fallback text from seed data — shown if PSK API is unavailable
const FALLBACK: ApsResponse = {
  source: 'fallback',
  updatedAt: new Date().toISOString(),
  isFallback: true,
  schedule: [
    {
      date: '',
      from: '00:00',
      to: '23:59',
      facility: 'Nemocnica Snina, s.r.o.',
      phone: '+421 57 766 01 11',
      address: 'Sládkovičova 300/3, 069 01 Snina',
      type: 'adult',
    },
  ],
};

// In-memory cache — used when Redis is unreachable (graceful degradation)
const memCache = new Map<string, { data: ApsResponse; expiresAt: number }>();

@Injectable()
export class ApsService implements OnModuleDestroy {
  private readonly logger = new Logger(ApsService.name);
  private redis: Redis | null = null;
  private readonly ttlSeconds: number;
  private readonly ttlMs: number;

  constructor(private readonly cfg: ConfigService) {
    this.ttlSeconds = cfg.get<number>('APS_CACHE_TTL_SECONDS') ?? 600;
    this.ttlMs = this.ttlSeconds * 1000;

    const redisUrl = cfg.get<string>('REDIS_URL');
    if (redisUrl) {
      try {
        this.redis = new Redis(redisUrl, {
          lazyConnect: true,
          enableOfflineQueue: false,
          maxRetriesPerRequest: 1,
          connectTimeout: 3000,
        });

        this.redis.on('error', (err) => {
          this.logger.warn(`Redis connection error (APS will use in-memory cache): ${String(err)}`);
        });
      } catch (err) {
        this.logger.warn(`Failed to create Redis client: ${String(err)}`);
        this.redis = null;
      }
    } else {
      this.logger.warn('REDIS_URL not set — APS will use in-memory cache only');
    }
  }

  async onModuleDestroy() {
    if (this.redis) {
      await this.redis.quit().catch(() => void 0);
    }
  }

  // ── Redis helpers ────────────────────────────────────────────

  private async redisGet(key: string): Promise<ApsResponse | null> {
    if (!this.redis) return null;
    try {
      const raw = await this.redis.get(key);
      if (!raw) return null;
      return JSON.parse(raw) as ApsResponse;
    } catch {
      return null;
    }
  }

  private async redisSet(key: string, value: ApsResponse): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.set(key, JSON.stringify(value), 'EX', this.ttlSeconds);
    } catch (err) {
      this.logger.warn(`Redis SET failed (APS will fall back to mem-cache): ${String(err)}`);
    }
  }

  // ── Public API ───────────────────────────────────────────────

  async getSchedule(district = 'snina'): Promise<ApsResponse> {
    const cacheKey = `aps:${district}`;

    // 1. Try Redis
    const redisCached = await this.redisGet(cacheKey);
    if (redisCached) {
      return { ...redisCached, source: 'cache' };
    }

    // 2. Try in-memory cache
    const memCached = memCache.get(cacheKey);
    if (memCached && memCached.expiresAt > Date.now()) {
      return { ...memCached.data, source: 'cache' };
    }

    // 3. Fetch live
    try {
      const apiUrl = this.cfg.get<string>('PSK_APS_API_URL');
      if (!apiUrl) {
        this.logger.warn('PSK_APS_API_URL not set — using APS fallback');
        return FALLBACK;
      }

      const res = await fetch(`${apiUrl}?district=${encodeURIComponent(district)}`, {
        signal: AbortSignal.timeout(5000), // 5s timeout
        headers: { Accept: 'application/json' },
      });

      if (!res.ok) throw new Error(`PSK APS API returned HTTP ${res.status}`);

      const raw = await res.json() as { schedule?: ApsEntry[] };
      const response: ApsResponse = {
        source: 'live',
        updatedAt: new Date().toISOString(),
        schedule: raw.schedule ?? [],
      };

      // Write to Redis (primary) and mem-cache (backup)
      await this.redisSet(cacheKey, response);
      memCache.set(cacheKey, { data: response, expiresAt: Date.now() + this.ttlMs });

      return response;
    } catch (err) {
      this.logger.warn(`APS live feed unavailable, using fallback: ${String(err)}`);
      return FALLBACK;
    }
  }
}
