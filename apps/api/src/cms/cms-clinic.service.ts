/**
 * CMS clinic source for the NestJS API.
 *
 * Fetches clinic records from Strapi so booking-rule enforcement uses the
 * same data as the public site. Falls back to the local seed when
 * STRAPI_API_TOKEN is unset or 'dev-token' (local dev / CI).
 *
 * Results are cached in-memory for CLINIC_CACHE_TTL_MS (default 60 s).
 * The booking controller must call getClinicById() — NOT import CLINICS_SEED.
 */
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Clinic } from '@ns/types';
import { CLINICS_SEED } from '../config/seed-clinics';

const CLINIC_CACHE_TTL_MS = 60_000;

interface CacheEntry { data: Clinic[]; fetchedAt: number }

// ── Strapi response mappers ────────────────────────────────────

function mapStrapi(entry: Record<string, unknown>): Clinic {
  const a = (entry['attributes'] as Record<string, unknown>) ?? entry;
  return {
    id:            String(entry['id'] ?? (a['slug'] as string)),
    name:          { sk: String(a['name'] ?? '') },
    specialty:     { sk: String(a['specialty'] ?? '') },
    doctor:        String(a['doctor'] ?? ''),
    nurse:         a['nurse']  ? String(a['nurse'])  : undefined,
    location:      { sk: String(a['location'] ?? '') },
    phone:         a['phone']  ? String(a['phone'])  : undefined,
    status:        (a['status'] as Clinic['status']) ?? 'open',
    bookable:      Boolean(a['bookable']),
    referral:      Boolean(a['referral']),
    acceptingNew:  Boolean(a['acceptingNew']),
    bookingDays:   (a['bookingDays'] as Clinic['bookingDays']) ?? undefined,
    bookingWindow: a['bookingWindow'] ? String(a['bookingWindow']) : undefined,
    schedule:      { sk: (a['schedule'] as string[]) ?? [] },
    bookingRule:   { sk: String(a['bookingRule'] ?? '') },
    fee:           a['fee'] ? { sk: String(a['fee']) } : undefined,
    opened:        a['opened'] ? String(a['opened']) : undefined,
  };
}

@Injectable()
export class CmsClinicService implements OnModuleInit {
  private readonly logger = new Logger(CmsClinicService.name);
  private readonly strapiUrl: string;
  private readonly token: string;
  private readonly useFallback: boolean;
  private cache: CacheEntry | null = null;

  constructor(private readonly cfg: ConfigService) {
    this.strapiUrl   = cfg.get<string>('STRAPI_URL')        ?? 'http://localhost:1337';
    this.token       = cfg.get<string>('STRAPI_API_TOKEN')  ?? '';
    this.useFallback = !this.token || this.token === 'dev-token';
  }

  async onModuleInit() {
    // Pre-warm the cache at startup so the first request is fast.
    try {
      await this.getAllClinics();
    } catch {
      this.logger.warn('CmsClinicService: pre-warm failed — will retry on first request');
    }
  }

  async getAllClinics(): Promise<Clinic[]> {
    if (this.useFallback) return CLINICS_SEED;

    const now = Date.now();
    if (this.cache && now - this.cache.fetchedAt < CLINIC_CACHE_TTL_MS) {
      return this.cache.data;
    }

    try {
      const res = await fetch(
        `${this.strapiUrl}/api/clinics?sort=slug&pagination[pageSize]=100&populate=*`,
        { headers: { Authorization: `Bearer ${this.token}` } },
      );
      if (!res.ok) throw new Error(`Strapi /clinics HTTP ${res.status}`);

      const json = await res.json() as { data: Record<string, unknown>[] };
      const clinics = json.data.map(mapStrapi);
      this.cache = { data: clinics, fetchedAt: now };
      return clinics;
    } catch (err) {
      this.logger.error(`CmsClinicService: fetch failed, using last cache/seed: ${String(err)}`);
      return this.cache?.data ?? CLINICS_SEED;
    }
  }

  async getClinicById(id: string): Promise<Clinic | undefined> {
    const all = await this.getAllClinics();
    return all.find((c) => c.id === id);
  }

  /** Invalidate cache (called by Strapi webhook → /api/revalidate). */
  invalidate() {
    this.cache = null;
    this.logger.log('CmsClinicService: cache invalidated');
  }
}
