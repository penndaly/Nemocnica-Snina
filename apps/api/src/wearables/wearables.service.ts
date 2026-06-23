/**
 * WearablesService — production wiring (Sprint W4).
 *
 * Implements the patient-facing wearables flows against the active platform
 * adapter (mock in dev/CI, selected by WEARABLES_PROVIDER). All patient
 * references are the opaque patient_token; OAuth tokens are AES-256-GCM
 * encrypted at rest via TokenCryptoService; medical data lives only in the DB
 * and is returned through these DTOs (never localStorage).
 *
 * Mock provider self-seeds three demo devices on first read so the portal renders
 * without a separate seed step (window.NS_WEARABLES_DEMO is gone — this is the
 * live API path). The alert/FHIR-export hooks land in Sprint W5.
 */
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { DeviceReading, Prisma, WearableDevice } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ConsentService } from './consent.service';
import { TokenCryptoService } from './token-crypto.service';
import { OAuthStateService } from './oauth-state.service';
import { AlertService } from './alert.service';
import { RK_READINGS_SYNCED, WearablesQueueService } from './wearables-queue.service';
import {
  WEARABLE_ADAPTER,
  type RawReading,
  type WearablePlatformAdapter,
} from './platform-adapter.interface';
import {
  availablePlatforms,
  getPlatformEntry,
  type PlatformCatalogEntry,
} from './platform-catalog';
import type {
  AvailablePlatformDto,
  ConnectResultDto,
  ConsentAuditEntryDto,
  ConsentDto,
  ConsentUpdatePayload,
  SyncJobDto,
  UploadResultDto,
  WearableDeviceDto,
  WearableReadingDto,
  WearablesResponseDto,
} from './dto';

@Injectable()
export class WearablesService {
  private readonly logger = new Logger(WearablesService.name);
  private readonly provider: string;
  private readonly redirectBase: string;
  private readonly accessWindowDays: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly consent: ConsentService,
    private readonly crypto: TokenCryptoService,
    private readonly oauthState: OAuthStateService,
    private readonly cfg: ConfigService,
    private readonly alerts: AlertService,
    private readonly queue: WearablesQueueService,
    @Inject(WEARABLE_ADAPTER) private readonly adapter: WearablePlatformAdapter,
  ) {
    this.provider = this.cfg.get<string>('WEARABLES_PROVIDER') ?? 'mock';
    this.redirectBase =
      this.cfg.get<string>('WEARABLES_OAUTH_REDIRECT_BASE') ?? 'http://localhost:4000';
    this.accessWindowDays = Number(this.cfg.get<string>('WEARABLES_PHYSICIAN_ACCESS_WINDOW_DAYS') ?? 90);
  }

  private get isMock(): boolean {
    return this.provider === 'mock';
  }

  // ── GET /api/wearables ────────────────────────────────────────────────────
  async listDevices(patientToken: string): Promise<WearablesResponseDto> {
    if (this.isMock) await this.ensureMockDevices(patientToken);

    const devices = await this.prisma.wearableDevice.findMany({
      where: { patientToken, disconnectedAt: null },
      orderBy: { connectedAt: 'asc' },
      include: {
        readings: { orderBy: { recordedAt: 'desc' }, take: 20 },
      },
    });

    const available: AvailablePlatformDto[] = availablePlatforms().map((p) => ({
      platform: p.platform,
      brand: p.brand,
      model: p.model,
      category: p.category,
      deviceType: p.deviceType,
      partnershipRequired: p.partnershipRequired,
      manualUploadOnly: p.manualUploadOnly,
      iosAppRequired: p.iosAppRequired,
    }));

    return { devices: devices.map((d) => this.mapDevice(d, d.readings)), available };
  }

  // ── POST /api/wearables/connect/:platform ─────────────────────────────────
  connect(patientToken: string, platform: string): ConnectResultDto {
    const entry = getPlatformEntry(platform);
    if (!entry) throw new NotFoundException('UNKNOWN_PLATFORM');
    if (entry.partnershipRequired) {
      throw new BadRequestPartnership(platform);
    }
    if (entry.manualUploadOnly) {
      throw new BadRequestUploadOnly(platform);
    }
    if (entry.iosAppRequired) {
      throw new BadRequestIosApp(platform);
    }

    const state = this.oauthState.generateState(patientToken, platform);
    const authUrl = this.isMock
      ? `${this.redirectBase}/api/wearables/callback/${platform}?code=mock-code&state=${encodeURIComponent(state)}`
      : this.adapter.getAuthUrl(patientToken, state);
    return { authUrl };
  }

  // ── GET /api/wearables/callback/:platform ─────────────────────────────────
  /** Returns the absolute portal URL to redirect the browser back to. */
  async handleCallback(platform: string, code: string, state: string): Promise<string> {
    const { patientToken } = this.oauthState.validateState(state, platform);
    const entry = getPlatformEntry(platform);
    if (!entry) throw new NotFoundException('UNKNOWN_PLATFORM');

    const token = await this.adapter.exchangeCode(code, state);

    const device = await this.prisma.wearableDevice.create({
      data: {
        patientToken,
        platform: entry.platform,
        deviceLabel: `${entry.brand} ${entry.model}`,
        category: entry.category,
        deviceType: entry.deviceType,
        oauthAccessTokenEnc: token.accessToken ? this.crypto.encryptToken(token.accessToken) : null,
        oauthRefreshTokenEnc: token.refreshToken ? this.crypto.encryptToken(token.refreshToken) : null,
        oauthExpiresAt: token.expiresAt ?? null,
        partnershipRequired: entry.partnershipRequired,
        shareWithPhysician: true,
        syncStatus: 'ok',
        lastSyncAt: new Date(),
      },
    });

    // data_storage (required) + physician_sharing (default-on, per prototype).
    await this.consent.grantConsent(
      patientToken,
      device.id,
      ['data_storage', 'physician_sharing'],
      'oauth-callback',
    );

    // Pull an initial batch of readings so the card is not empty.
    const readings = await this.adapter.syncReadings(device, new Date(0));
    await this.persistReadings(device, readings);

    await this.audit.log({
      actorEmail: `patient:${patientToken.slice(0, 8)}`,
      actorRole: 'patient',
      action: 'wearable_device_connected',
      resource: 'wearable_device',
      resourceId: device.id,
      detail: { platform: entry.platform },
    });

    const webBase = this.cfg.get<string>('WEB_PORTAL_BASE_URL') ?? 'http://localhost:3000';
    return `${webBase}/sk/portal?tab=wearables&connected=${encodeURIComponent(platform)}`;
  }

  // ── DELETE /api/wearables/devices/:deviceId ───────────────────────────────
  async disconnect(patientToken: string, deviceId: string): Promise<{ ok: true }> {
    await this.consent.withdrawConsent(patientToken, deviceId);
    return { ok: true };
  }

  // ── GET /api/wearables/devices/:deviceId/readings ─────────────────────────
  async getReadings(
    patientToken: string,
    deviceId: string,
    limit = 50,
  ): Promise<WearableReadingDto[]> {
    await this.assertOwnership(patientToken, deviceId);
    const readings = await this.prisma.deviceReading.findMany({
      where: { deviceId, supersededBy: null },
      orderBy: { recordedAt: 'desc' },
      take: Math.min(limit, 200),
    });
    return readings.map((r) => this.formatReading(r));
  }

  // ── POST /api/wearables/devices/:deviceId/sync ────────────────────────────
  async sync(patientToken: string, deviceId: string): Promise<SyncJobDto> {
    const device = await this.assertOwnership(patientToken, deviceId);

    const job = await this.prisma.deviceSyncJob.create({
      data: { deviceId, status: 'running', startedAt: new Date() },
    });

    try {
      const refreshed = await this.refreshTokenIfNeeded(device);
      if (!refreshed) {
        // Token refresh failed — device marked error + notification already raised.
        const failed = await this.prisma.deviceSyncJob.update({
          where: { id: job.id },
          data: { status: 'failed', completedAt: new Date(), error: 'token_refresh_failed' },
        });
        return this.mapJob(failed);
      }
      const since = refreshed.lastSyncAt ?? new Date(0);
      const raw = await this.adapter.syncReadings(refreshed, since);
      const ids = await this.ingestReadings(refreshed, raw);
      const done = await this.prisma.deviceSyncJob.update({
        where: { id: job.id },
        data: { status: 'completed', completedAt: new Date(), readingsFetched: ids.length },
      });
      await this.prisma.wearableDevice.update({
        where: { id: deviceId },
        data: { lastSyncAt: new Date(), syncStatus: 'ok', syncError: null },
      });
      return this.mapJob(done);
    } catch (err) {
      const failed = await this.prisma.deviceSyncJob.update({
        where: { id: job.id },
        data: { status: 'failed', completedAt: new Date(), error: String(err) },
      });
      await this.prisma.wearableDevice.update({
        where: { id: deviceId },
        data: { syncStatus: 'error', syncError: 'sync_failed' },
      });
      return this.mapJob(failed);
    }
  }

  // ── GET /api/wearables/devices/:deviceId/sync/:jobId ──────────────────────
  async getSyncJob(patientToken: string, deviceId: string, jobId: string): Promise<SyncJobDto> {
    await this.assertOwnership(patientToken, deviceId);
    const job = await this.prisma.deviceSyncJob.findFirst({ where: { id: jobId, deviceId } });
    if (!job) throw new NotFoundException('SYNC_JOB_NOT_FOUND');
    return this.mapJob(job);
  }

  // ── PUT /api/wearables/devices/:deviceId/consent ──────────────────────────
  async updateConsent(
    patientToken: string,
    deviceId: string,
    payload: ConsentUpdatePayload,
    ipHash: string,
  ): Promise<ConsentDto> {
    await this.consent.setConsent(patientToken, deviceId, payload.type, payload.granted, ipHash);
    return this.getConsent(patientToken, deviceId);
  }

  // ── GET /api/wearables/devices/:deviceId/consents ─────────────────────────
  async getConsent(patientToken: string, deviceId: string): Promise<ConsentDto> {
    const device = await this.assertOwnership(patientToken, deviceId);
    const rows = await this.prisma.deviceConsent.findMany({
      where: { deviceId },
      orderBy: { grantedAt: 'desc' },
    });
    // Latest row per consent type wins.
    const latest = new Map<string, (typeof rows)[number]>();
    for (const r of rows) if (!latest.has(r.consentType)) latest.set(r.consentType, r);

    return {
      deviceId,
      shareWithPhysician: device.shareWithPhysician,
      consents: [...latest.values()].map((r) => ({
        consentType: r.consentType,
        granted: r.granted && r.withdrawnAt === null,
        grantedAt: r.grantedAt.toISOString(),
        withdrawnAt: r.withdrawnAt ? r.withdrawnAt.toISOString() : null,
      })),
    };
  }

  // ── GET /api/wearables/consents/audit ─────────────────────────────────────
  async getConsentAuditLog(
    patientToken: string,
    deviceId?: string,
  ): Promise<ConsentAuditEntryDto[]> {
    const rows = await this.prisma.deviceConsent.findMany({
      where: { patientToken, ...(deviceId ? { deviceId } : {}) },
      include: { device: { select: { deviceLabel: true } } },
    });

    const entries: ConsentAuditEntryDto[] = [];
    for (const r of rows) {
      entries.push({
        id: `${r.id}:granted`,
        deviceId: r.deviceId,
        deviceLabel: r.device.deviceLabel,
        consentType: r.consentType,
        action: 'granted',
        ts: r.grantedAt.toISOString(),
        ipHash: r.ipHash,
      });
      if (r.withdrawnAt) {
        entries.push({
          id: `${r.id}:withdrawn`,
          deviceId: r.deviceId,
          deviceLabel: r.device.deviceLabel,
          consentType: r.consentType,
          action: 'withdrawn',
          ts: r.withdrawnAt.toISOString(),
          ipHash: r.ipHash,
        });
      }
    }
    entries.sort((a, b) => b.ts.localeCompare(a.ts));
    return entries.slice(0, 200);
  }

  // ── POST /api/wearables/:platform/upload (AliveCor PDF / Xiaomi zip) ───────
  async upload(
    patientToken: string,
    platform: string,
    file: { originalname?: string; size?: number } | undefined,
  ): Promise<UploadResultDto> {
    const entry = getPlatformEntry(platform);
    if (!entry || !entry.manualUploadOnly) throw new NotFoundException('UPLOAD_NOT_SUPPORTED');
    if (!file) throw new NotFoundException('NO_FILE');

    // Reuse an existing manual device for this platform, or create one.
    let device = await this.prisma.wearableDevice.findFirst({
      where: { patientToken, platform: entry.platform, disconnectedAt: null },
    });
    if (!device) {
      device = await this.prisma.wearableDevice.create({
        data: {
          patientToken,
          platform: entry.platform,
          deviceLabel: `${entry.brand} ${entry.model}`,
          category: entry.category,
          deviceType: entry.deviceType,
          shareWithPhysician: true,
          syncStatus: 'ok',
          lastSyncAt: new Date(),
        },
      });
      await this.consent.grantConsent(patientToken, device.id, ['data_storage'], 'manual-upload');
    }

    // Mock parse: produce one reading representative of the device type.
    const raw = this.mockReadingsFor(entry);
    const inserted = await this.persistReadings(device, raw.slice(0, 1));

    await this.audit.log({
      actorEmail: `patient:${patientToken.slice(0, 8)}`,
      actorRole: 'patient',
      action: 'wearable_manual_upload',
      resource: 'wearable_device',
      resourceId: device.id,
      detail: { platform: entry.platform, filename: file.originalname ?? 'upload' },
    });

    return { deviceId: device.id, readingsImported: inserted };
  }

  // ── GET /api/wearables/physician/:patientToken (clinician JWT) ────────────
  async physicianView(patientToken: string, physicianId: string): Promise<{ patientToken: string; devices: unknown[]; alerts: unknown[] }> {
    await this.assertPhysicianAccess(physicianId, patientToken);

    const devices = await this.prisma.wearableDevice.findMany({
      where: { patientToken, shareWithPhysician: true, disconnectedAt: null },
      include: { readings: { orderBy: { recordedAt: 'desc' }, take: 10 } },
    });

    const since = new Date(Date.now() - 7 * 86_400_000);
    const alerts = await this.prisma.portalNotification.findMany({
      where: { patientToken, type: 'wearable_alert', createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return {
      patientToken,
      devices: devices.map((d) => this.mapDevice(d, d.readings)),
      alerts: alerts.map((a) => ({
        id: a.id, deviceId: a.deviceId, metricType: a.metricType, value: a.value,
        flag: a.flag, severity: a.severity, createdAt: a.createdAt.toISOString(),
      })),
    };
  }

  /**
   * Physician access gate (W5; tightened in W6). Allowed when the physician has a
   * telehealth relationship with the patient within the access window. Throws
   * 403 PHYSICIAN_ACCESS_DENIED otherwise. Also requires a granted
   * physician_sharing consent for the patient.
   */
  async assertPhysicianAccess(physicianId: string, patientToken: string): Promise<void> {
    const since = new Date(Date.now() - this.accessWindowDays * 86_400_000);

    // Condition B — active/recent telehealth relationship within the window.
    // (Condition A — recent appointment — N/A: bookings carry no physician_id in
    //  this schema; see CLAUDE.md. Condition C — explicit named-access consent.)
    const [session, namedAccess] = await Promise.all([
      this.prisma.telehealthSession.findFirst({
        where: { physicianId, patientToken, scheduledAt: { gte: since } },
        select: { id: true },
      }),
      this.prisma.deviceConsent.findFirst({
        where: { patientToken, consentType: 'physician_named_access', granted: true, withdrawnAt: null },
        select: { id: true },
      }),
    ]);
    if (!session && !namedAccess) {
      throw new ForbiddenException('PHYSICIAN_ACCESS_DENIED');
    }

    // Patient must also share with physicians at all.
    const sharing = await this.prisma.deviceConsent.findFirst({
      where: { patientToken, consentType: 'physician_sharing', granted: true, withdrawnAt: null },
      select: { id: true },
    });
    if (!sharing) {
      throw new ForbiddenException('PHYSICIAN_ACCESS_DENIED');
    }
  }

  // ── PUT /api/wearables/physician/:patientToken/thresholds (clinician role) ─
  async setThresholds(
    patientToken: string,
    physicianId: string,
    role: string,
    metricType: string,
    t: { high?: number | null; low?: number | null; criticalHigh?: number | null; criticalLow?: number | null },
  ): Promise<{ ok: true }> {
    if (role !== 'CLINICIAN' && role !== 'ADMIN') {
      throw new ForbiddenException('THRESHOLD_PHYSICIAN_ONLY');
    }
    const data = {
      thresholdHigh: t.high ?? null,
      thresholdLow: t.low ?? null,
      thresholdCriticalHigh: t.criticalHigh ?? null,
      thresholdCriticalLow: t.criticalLow ?? null,
      setByPhysicianId: physicianId,
    };
    await this.prisma.deviceAlertThreshold.upsert({
      where: { patientToken_metricType: { patientToken, metricType } },
      update: data,
      create: { patientToken, metricType, ...data },
    });
    await this.audit.log({
      actorEmail: `physician:${physicianId}`,
      actorRole: role,
      action: 'threshold_updated',
      resource: 'device_alert_thresholds',
      resourceId: `${patientToken}:${metricType}`,
      detail: { metricType, ...t },
    });
    return { ok: true };
  }

  // ── POST /api/wearables/devices/:deviceId/export-fhir ─────────────────────
  /** Re-publish unexported readings for FHIR export (manual physician trigger). */
  async requestFhirExport(deviceId: string): Promise<{ queued: number }> {
    const device = await this.prisma.wearableDevice.findUnique({ where: { id: deviceId } });
    if (!device) throw new NotFoundException('DEVICE_NOT_FOUND');
    const readings = await this.prisma.deviceReading.findMany({
      where: { deviceId, fhirObservationId: null, supersededBy: null },
      select: { id: true },
    });
    if (readings.length > 0) {
      await this.queue.publish(RK_READINGS_SYNCED, {
        deviceId,
        patientToken: device.patientToken,
        readingIds: readings.map((r) => r.id),
      });
    }
    return { queued: readings.length };
  }

  // ── OAuth token rotation (W6) ─────────────────────────────────────────────
  /**
   * Refresh the device's OAuth token if it expires within 5 minutes. Returns the
   * (possibly updated) device, or null if refresh failed — in which case the
   * device is marked error and a portal notification is raised (no SMS, to avoid
   * leaking device existence to a phone). Old plaintext token is dropped after
   * re-encryption.
   */
  async refreshTokenIfNeeded(device: WearableDevice): Promise<WearableDevice | null> {
    const soon = Date.now() + 5 * 60_000;
    if (!device.oauthExpiresAt || device.oauthExpiresAt.getTime() > soon) {
      return device; // nothing to do (or mock-seeded device with no token)
    }
    try {
      const token = await this.adapter.refreshToken(device);
      const updated = await this.prisma.wearableDevice.update({
        where: { id: device.id },
        data: {
          oauthAccessTokenEnc: token.accessToken ? this.crypto.encryptToken(token.accessToken) : null,
          oauthRefreshTokenEnc: token.refreshToken ? this.crypto.encryptToken(token.refreshToken) : null,
          oauthExpiresAt: token.expiresAt ?? null,
        },
      });
      return updated;
    } catch (err) {
      this.logger.warn(`Token refresh failed for device ${device.id}: ${String(err)}`);
      await this.prisma.wearableDevice.update({
        where: { id: device.id },
        data: { syncStatus: 'error', syncError: 'token_refresh_failed' },
      });
      await this.prisma.portalNotification.create({
        data: {
          patientToken: device.patientToken,
          type: 'wearable_token_expired',
          severity: 'info',
          deviceId: device.id,
          message: 'Wearable re-authentication required',
        },
      });
      return null;
    }
  }

  // ── Admin/test reading injection — drives alert E2E (WR-W5-1 / WR-3) ──────
  async injectReading(
    deviceId: string,
    payload: { metricType: string; value: number; unit?: string },
  ): Promise<{ flag: string }> {
    const device = await this.prisma.wearableDevice.findUnique({ where: { id: deviceId } });
    if (!device) throw new NotFoundException('DEVICE_NOT_FOUND');
    const ids = await this.ingestReadings(device, [{
      metricType: payload.metricType,
      metricLabel: { sk: payload.metricType, en: payload.metricType },
      valueNumeric: payload.value,
      unit: payload.unit ?? '',
      recordedAt: new Date(),
    }]);
    const reading = await this.prisma.deviceReading.findUnique({ where: { id: ids[0] } });
    return { flag: reading?.flag ?? 'normal' };
  }

  // ── Portal notifications (alert bell) ─────────────────────────────────────
  async listNotifications(patientToken: string, type?: string) {
    return this.prisma.portalNotification.findMany({
      where: { patientToken, ...(type ? { type } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async unreadCount(patientToken: string, type?: string): Promise<number> {
    return this.prisma.portalNotification.count({
      where: { patientToken, readAt: null, ...(type ? { type } : {}) },
    });
  }

  async markNotificationsRead(patientToken: string, type?: string): Promise<{ updated: number }> {
    const res = await this.prisma.portalNotification.updateMany({
      where: { patientToken, readAt: null, ...(type ? { type } : {}) },
      data: { readAt: new Date() },
    });
    return { updated: res.count };
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  /**
   * Insert readings one-by-one (to get ids), classify each via the alert engine
   * (persisting the resolved flag + emitting alerts), then publish
   * wearables.readings.synced to drive FHIR export. Returns the new reading ids.
   */
  private async ingestReadings(device: WearableDevice, raw: RawReading[]): Promise<string[]> {
    const ids: string[] = [];
    for (const r of raw) {
      const created = await this.prisma.deviceReading.create({
        data: {
          deviceId: device.id,
          patientToken: device.patientToken,
          metricType: r.metricType,
          metricLabel: r.metricLabel as Prisma.InputJsonValue,
          valueNumeric: r.valueNumeric ?? null,
          valueText: r.valueText ?? null,
          unit: r.unit,
          flag: r.flag ?? 'normal',
          recordedAt: r.recordedAt,
        },
      });
      const result = await this.alerts.processReading(device, created);
      if (result.flag !== created.flag) {
        await this.prisma.deviceReading.update({ where: { id: created.id }, data: { flag: result.flag } });
      }
      ids.push(created.id);
    }
    if (ids.length > 0) {
      await this.queue.publish(RK_READINGS_SYNCED, {
        deviceId: device.id,
        patientToken: device.patientToken,
        readingIds: ids,
      });
    }
    return ids;
  }

  private async assertOwnership(patientToken: string, deviceId: string): Promise<WearableDevice> {
    const device = await this.prisma.wearableDevice.findFirst({ where: { id: deviceId, patientToken } });
    if (!device) throw new NotFoundException('DEVICE_NOT_FOUND');
    return device;
  }

  private async persistReadings(device: WearableDevice, raw: RawReading[]): Promise<number> {
    if (raw.length === 0) return 0;
    const data: Prisma.DeviceReadingCreateManyInput[] = raw.map((r) => ({
      deviceId: device.id,
      patientToken: device.patientToken,
      metricType: r.metricType,
      metricLabel: r.metricLabel as Prisma.InputJsonValue,
      valueNumeric: r.valueNumeric ?? null,
      valueText: r.valueText ?? null,
      unit: r.unit,
      flag: r.flag ?? 'normal',
      recordedAt: r.recordedAt,
    }));
    const res = await this.prisma.deviceReading.createMany({ data });
    return res.count;
  }

  private mapJob(job: { id: string; status: string; readingsFetched: number; error: string | null }): SyncJobDto {
    return {
      jobId: job.id,
      status: job.status,
      readingsFetched: job.readingsFetched,
      error: job.error,
    };
  }

  private mapDevice(
    device: WearableDevice,
    readings: DeviceReading[],
  ): WearableDeviceDto {
    const entry = getPlatformEntry(device.platform);
    const label = device.deviceLabel.split(' ');
    return {
      id: device.id,
      platform: device.platform,
      brand: entry?.brand ?? label[0] ?? device.platform,
      model: entry?.model ?? label.slice(1).join(' ') ?? '',
      category: device.category,
      deviceType: device.deviceType,
      status: device.syncStatus,
      shareWithPhysician: device.shareWithPhysician,
      partnershipRequired: device.partnershipRequired,
      lastSyncAt: device.lastSyncAt ? device.lastSyncAt.toISOString() : null,
      connectedAt: device.connectedAt.toISOString(),
      readings: readings.map((r) => this.formatReading(r)),
    };
  }

  private formatReading(r: DeviceReading): WearableReadingDto {
    const label = (r.metricLabel ?? {}) as { sk?: string; en?: string } & Record<string, string>;
    const value = r.valueText ?? (r.valueNumeric !== null ? String(r.valueNumeric) : '');
    return {
      id: r.id,
      metricType: r.metricType,
      metricLabel: { sk: label.sk ?? r.metricType, en: label.en ?? r.metricType, ...label },
      value,
      unit: r.unit,
      flag: r.flag,
      recordedAt: r.recordedAt.toISOString(),
      inHis: r.fhirObservationId !== null,
    };
  }

  /**
   * Idempotently seed the three demo devices (CGM + smartwatch + BP hybrid) used
   * by the prototype, so the mock-provider portal renders with data. Runs only
   * when the patient has no devices at all.
   */
  private async ensureMockDevices(patientToken: string): Promise<void> {
    const existing = await this.prisma.wearableDevice.count({ where: { patientToken } });
    if (existing > 0) return;

    const seed: PlatformCatalogEntry[] = [
      getPlatformEntry('abbott_libre')!,
      getPlatformEntry('apple_health')!,
      getPlatformEntry('withings')!,
    ];

    for (const entry of seed) {
      const device = await this.prisma.wearableDevice.create({
        data: {
          patientToken,
          platform: entry.platform,
          deviceLabel: `${entry.brand} ${entry.model}`,
          category: entry.category,
          deviceType: entry.deviceType,
          shareWithPhysician: true,
          syncStatus: 'ok',
          lastSyncAt: new Date(Date.now() - 5 * 60_000),
        },
      });
      await this.consent.grantConsent(
        patientToken,
        device.id,
        ['data_storage', 'physician_sharing'],
        'mock-seed',
      );
      await this.persistReadings(device, this.mockReadingsFor(entry));
    }

    this.logger.log(`Seeded 3 mock wearable devices for patient ${patientToken.slice(0, 8)}…`);
  }

  /** Representative readings per device type (LOINC-coded), used by the mock seed. */
  private mockReadingsFor(entry: PlatformCatalogEntry): RawReading[] {
    const now = Date.now();
    const m = (mins: number) => new Date(now - mins * 60_000);
    switch (entry.deviceType) {
      case 'cgm':
        return [
          { metricType: '14745-4', metricLabel: { sk: 'Glukóza', en: 'Glucose' }, valueNumeric: 5.8, unit: 'mmol/l', flag: 'normal', recordedAt: m(5) },
          { metricType: '14745-4', metricLabel: { sk: 'Glukóza', en: 'Glucose' }, valueNumeric: 7.2, unit: 'mmol/l', flag: 'normal', recordedAt: m(65) },
        ];
      case 'smartwatch':
        return [
          { metricType: '8867-4', metricLabel: { sk: 'Tepová frekvencia', en: 'Heart rate' }, valueNumeric: 72, unit: 'bpm', flag: 'normal', recordedAt: m(12) },
          { metricType: '55423-8', metricLabel: { sk: 'Kroky (dnes)', en: 'Steps (today)' }, valueNumeric: 1240, unit: '', flag: 'normal', recordedAt: m(30) },
          { metricType: '11524-6', metricLabel: { sk: 'EKG', en: 'ECG' }, valueText: 'Sinus rhythm', unit: '', flag: 'normal', recordedAt: m(120) },
          { metricType: '59408-5', metricLabel: { sk: 'SpO₂', en: 'SpO₂' }, valueNumeric: 97, unit: '%', flag: 'normal', recordedAt: m(480) },
        ];
      case 'hybrid':
      case 'bp':
        return [
          { metricType: '85354-9', metricLabel: { sk: 'Krvný tlak', en: 'Blood pressure' }, valueText: '128/82', unit: 'mmHg', flag: 'normal', recordedAt: m(45) },
          { metricType: '93831-6', metricLabel: { sk: 'Spánok', en: 'Sleep' }, valueText: '6h 40min', unit: '', flag: 'normal', recordedAt: m(480) },
        ];
      case 'ecg':
        return [
          { metricType: '11524-6', metricLabel: { sk: 'EKG', en: 'ECG' }, valueText: 'Sinus rhythm', unit: '', flag: 'normal', recordedAt: m(10) },
        ];
      default:
        return [
          { metricType: '8867-4', metricLabel: { sk: 'Tepová frekvencia', en: 'Heart rate' }, valueNumeric: 70, unit: 'bpm', flag: 'normal', recordedAt: m(15) },
        ];
    }
  }
}

// ── Typed platform-gate errors (mapped to HTTP by the controller) ────────────
class BadRequestPartnership extends BadRequestException {
  constructor(platform: string) {
    super({ code: 'partnership_required', platform });
  }
}
class BadRequestUploadOnly extends BadRequestException {
  constructor(platform: string) {
    super({ code: 'manual_upload_only', platform });
  }
}
class BadRequestIosApp extends BadRequestException {
  constructor(platform: string) {
    super({ code: 'IOS_APP_REQUIRED', platform });
  }
}
