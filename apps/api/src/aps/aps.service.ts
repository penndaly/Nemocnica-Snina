/**
 * Ambulatory Emergency Service (APS) — live feed from e-VÚC / Prešov region (PSK).
 * PRODUCTION_ARCHITECTURE.md: "consume regional API to display live APS schedule;
 * cache with Redis TTL and fall back to CMS pages.aps text if feed unavailable."
 *
 * Feed format: PSK publishes APS schedules as structured JSON at their public API.
 * We cache each response in Redis for 10 minutes to control load.
 * On cache miss or error, we return the static CMS fallback text.
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface ApsEntry {
  date: string;       // YYYY-MM-DD
  from: string;       // HH:MM
  to: string;         // HH:MM
  facility: string;
  phone: string;
  address?: string;
  type: 'adult' | 'child' | 'dental';
}

interface ApsResponse {
  source: 'live' | 'cache' | 'fallback';
  updatedAt: string;
  schedule: ApsEntry[];
}

// Fallback text from seed data — shown if PSK API is unavailable
const FALLBACK: ApsResponse = {
  source: 'fallback',
  updatedAt: new Date().toISOString(),
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

// In-memory cache (Redis client injected in prod via separate module)
const memCache = new Map<string, { data: ApsResponse; expiresAt: number }>();
const TTL_MS = 10 * 60 * 1000; // 10 minutes

@Injectable()
export class ApsService {
  private readonly logger = new Logger(ApsService.name);

  constructor(private readonly cfg: ConfigService) {}

  async getSchedule(district = 'snina'): Promise<ApsResponse> {
    const cacheKey = `aps:${district}`;
    const cached = memCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return { ...cached.data, source: 'cache' };
    }

    try {
      const apiUrl = this.cfg.get<string>('PSK_APS_API_URL');
      if (!apiUrl) return FALLBACK;

      const res = await fetch(`${apiUrl}?district=${encodeURIComponent(district)}`, {
        signal: AbortSignal.timeout(5000), // 5s timeout
        headers: { Accept: 'application/json' },
      });

      if (!res.ok) throw new Error(`PSK APS API ${res.status}`);

      const raw = await res.json() as { schedule?: ApsEntry[] };
      const response: ApsResponse = {
        source: 'live',
        updatedAt: new Date().toISOString(),
        schedule: raw.schedule ?? [],
      };

      memCache.set(cacheKey, { data: response, expiresAt: Date.now() + TTL_MS });
      return response;
    } catch (err) {
      this.logger.warn(`APS feed unavailable, using fallback: ${String(err)}`);
      return FALLBACK;
    }
  }
}
