/**
 * Wearables platform-management service (Sprint A4, Part C1) — super_admin only.
 *
 * Exposes platform status (enabled, credentialsConfigured, connected device count,
 * last sync) for every catalog entry, lets a super_admin toggle a platform on/off
 * (persisted to wearable_platform_overrides), and runs a read-only connection probe.
 *
 * Credentials are NEVER returned — only `credentialsConfigured: boolean`, derived
 * from whether the required env vars are present and non-empty.
 */
import {
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { WearablePlatform } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PLATFORM_CATALOG, type PlatformCatalogEntry } from './platform-catalog';
import type { StaffActor } from '../booking/booking-admin.service';

/** Required env vars per platform (live OAuth/API credentials). */
const CREDENTIAL_ENV: Partial<Record<WearablePlatform, string[]>> = {
  abbott_libre: ['LIBRE_CLIENT_ID', 'LIBRE_CLIENT_SECRET'],
  dexcom: ['DEXCOM_CLIENT_ID', 'DEXCOM_CLIENT_SECRET'],
  withings: ['WITHINGS_CLIENT_ID', 'WITHINGS_CLIENT_SECRET'],
  omron: ['OMRON_CLIENT_ID', 'OMRON_CLIENT_SECRET'],
  alivecor: ['KARDIA_API_KEY'],
  fitbit: ['FITBIT_CLIENT_ID', 'FITBIT_CLIENT_SECRET'],
  garmin: ['GARMIN_CONSUMER_KEY', 'GARMIN_CONSUMER_SECRET'],
  google_health: ['GOOGLE_HEALTH_CLIENT_ID', 'GOOGLE_HEALTH_CLIENT_SECRET'],
  samsung_health: ['SAMSUNG_HEALTH_CLIENT_ID', 'SAMSUNG_HEALTH_CLIENT_SECRET'],
  apple_health: ['APPLE_HEALTH_BUNDLE_ID', 'APPLE_TEAM_ID'],
};

/** OAuth discovery / token endpoints used by the read-only connection test. */
const TEST_ENDPOINT: Partial<Record<WearablePlatform, string>> = {
  abbott_libre: 'https://api.libreview.io/llu/auth/login',
  dexcom: 'https://api.dexcom.eu/v2/oauth2/token',
  withings: 'https://wbsapi.withings.net/v2/oauth2',
  omron: 'https://oauth.ohiomron.eu/connect/token',
  fitbit: 'https://api.fitbit.com/oauth2/token',
  garmin: 'https://connectapi.garmin.com/oauth-service/oauth/request_token',
  google_health: 'https://oauth2.googleapis.com/token',
  samsung_health: 'https://api.health.samsung.com/oauth2/token',
};

const HUAWEI: WearablePlatform = 'huawei';

export interface PlatformStatusDto {
  id: WearablePlatform;
  name: string;
  category: 'medical' | 'consumer';
  partnershipRequired: boolean;
  manualUploadOnly: boolean;
  iosAppRequired: boolean;
  euBlocked: boolean;
  enabled: boolean;
  credentialsConfigured: boolean;
  connectedDeviceCount: number;
  lastSyncAt: Date | null;
  connectionTestUrl: string | null;
}

export interface TestConnectionResult {
  ok: boolean;
  latencyMs: number;
  httpStatus?: number;
  error?: string;
}

@Injectable()
export class WearablesAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cfg: ConfigService,
    private readonly audit: AuditService,
  ) {}

  // ── Platform status ────────────────────────────────────────────────────────

  async getPlatforms(): Promise<PlatformStatusDto[]> {
    const overrides = await this.prisma.wearablePlatformOverride.findMany();
    const overrideMap = new Map(overrides.map((o) => [o.platformId, o.enabled]));

    // Device counts + most-recent sync per platform, in two grouped queries.
    const counts = await this.prisma.wearableDevice.groupBy({
      by: ['platform'],
      where: { disconnectedAt: null },
      _count: { _all: true },
      _max: { lastSyncAt: true },
    });
    const countMap = new Map(
      counts.map((c) => [c.platform, { count: c._count._all, lastSyncAt: c._max.lastSyncAt }]),
    );

    return (Object.values(PLATFORM_CATALOG) as PlatformCatalogEntry[]).map((entry) => {
      const euBlocked = entry.platform === HUAWEI;
      const stat = countMap.get(entry.platform);
      const credentialsConfigured = this.credsConfigured(entry.platform);
      // Enable precedence: explicit override → else default-on for any platform
      // that is connectable (not partnership/blocked) and has credentials.
      const defaultEnabled = !entry.partnershipRequired && !euBlocked && credentialsConfigured;
      const enabled = overrideMap.has(entry.platform)
        ? overrideMap.get(entry.platform)!
        : defaultEnabled;
      const connectable = !entry.partnershipRequired && !euBlocked && !entry.manualUploadOnly;
      return {
        id: entry.platform,
        name: `${entry.brand} ${entry.model}`,
        category: entry.category,
        partnershipRequired: entry.partnershipRequired,
        manualUploadOnly: entry.manualUploadOnly,
        iosAppRequired: entry.iosAppRequired,
        euBlocked,
        enabled,
        credentialsConfigured,
        connectedDeviceCount: stat?.count ?? 0,
        lastSyncAt: stat?.lastSyncAt ?? null,
        connectionTestUrl: connectable ? TEST_ENDPOINT[entry.platform] ?? null : null,
      };
    });
  }

  private credsConfigured(platform: WearablePlatform): boolean {
    const required = CREDENTIAL_ENV[platform];
    if (!required || required.length === 0) return false;
    return required.every((name) => {
      const v = this.cfg.get<string>(name);
      return typeof v === 'string' && v.trim().length > 0;
    });
  }

  // ── Toggle ─────────────────────────────────────────────────────────────────

  async togglePlatform(actor: StaffActor, platformId: string, enabled: boolean, ip?: string) {
    const entry = PLATFORM_CATALOG[platformId as WearablePlatform];
    if (!entry) throw new UnprocessableEntityException({ code: 'unknown_platform', platformId });

    if (enabled) {
      // Huawei is a hard EU-adequacy block — distinct from a partnership gate.
      if (platformId === HUAWEI) {
        throw new UnprocessableEntityException({ code: 'eu_adequacy_blocked', platformId });
      }
      if (entry.partnershipRequired) {
        throw new UnprocessableEntityException({ code: 'partnership_required', platformId });
      }
    }

    const existing = await this.prisma.wearablePlatformOverride.findUnique({ where: { platformId } });
    const previousState = existing
      ? existing.enabled
      : !entry.partnershipRequired && platformId !== HUAWEI && this.credsConfigured(platformId as WearablePlatform);

    await this.prisma.wearablePlatformOverride.upsert({
      where: { platformId },
      update: { enabled, updatedBy: actor.staffId },
      create: { platformId, enabled, updatedBy: actor.staffId },
    });

    await this.audit.writeAuditEntry({
      // AuditLog.actorId has a hard FK to the legacy StaffUser table, not
      // StaffAccount (actor's type here) — omit it and keep the id in meta
      // instead. See staff-auth.service.ts's logEvent() for the original fix.
      actorName: actor.email,
      actorRole: actor.role,
      action: 'wearable_platform_toggled',
      targetType: 'wearable_platform',
      targetId: platformId,
      meta: { platformId, enabled, previousState, staffAccountId: actor.staffId },
      ipAddress: ip,
    });

    return { platformId, enabled };
  }

  // ── Connection test ──────────────────────────────────────────────────────────

  async testConnection(platformId: string): Promise<TestConnectionResult> {
    const url = TEST_ENDPOINT[platformId as WearablePlatform];
    if (!url) {
      return { ok: false, latencyMs: 0, error: 'no_test_endpoint' };
    }
    return this.probe(url);
  }

  /** Lightweight GET with a 5s timeout. Overridable in tests. Never throws. */
  protected async probe(url: string): Promise<TestConnectionResult> {
    const started = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(url, { method: 'GET', signal: controller.signal });
      return { ok: res.ok, latencyMs: Date.now() - started, httpStatus: res.status };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'probe_failed';
      return { ok: false, latencyMs: Date.now() - started, error: message };
    } finally {
      clearTimeout(timer);
    }
  }
}
