/**
 * Wearables REST API.
 *
 * Patient endpoints are protected by ConsentGuard, which validates the patient
 * session (x-patient-session JWT) and, for :deviceId routes, enforces
 * 'data_storage' consent. The resolved opaque patient_token is attached to the
 * request. The physician endpoint uses the staff JWT (AuthGuard('jwt')) — the two
 * auth schemes are never mixed (see CLAUDE.md conventions).
 *
 * Real behaviour wired in Sprint W4 (portal); alerts/FHIR/physician in W5.
 */
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { createHash } from 'crypto';
import { ConsentGuard } from './consent.guard';
import { WearablesService } from './wearables.service';
import type { ConsentUpdatePayload } from './dto';

interface PatientRequest {
  patientToken?: string;
  headers?: Record<string, string | string[] | undefined>;
  ip?: string;
}

interface RedirectResponse {
  redirect(url: string): void;
}

interface StaffRequest {
  user: { userId: string; email: string; role: string };
}

function ipHashOf(req: PatientRequest): string {
  const fwd = req.headers?.['x-forwarded-for'];
  const ip = (Array.isArray(fwd) ? fwd[0] : fwd) ?? req.ip ?? 'unknown';
  return createHash('sha256').update(String(ip)).digest('hex').slice(0, 32);
}

@Controller('api/wearables')
export class WearablesController {
  constructor(private readonly wearables: WearablesService) {}

  // GET /api/wearables — patient's connected devices + available platforms
  @Get()
  @UseGuards(ConsentGuard)
  list(@Req() req: PatientRequest) {
    return this.wearables.listDevices(req.patientToken ?? '');
  }

  // POST /api/wearables/connect/:platform — begin OAuth → { authUrl }
  @Post('connect/:platform')
  @UseGuards(ConsentGuard)
  connect(@Param('platform') platform: string, @Req() req: PatientRequest) {
    return this.wearables.connect(req.patientToken ?? '', platform);
  }

  // GET /api/wearables/callback/:platform — OAuth redirect (no auth; state-validated)
  @Get('callback/:platform')
  async callback(
    @Param('platform') platform: string,
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: RedirectResponse,
  ) {
    const portalUrl = await this.wearables.handleCallback(platform, code, state);
    res.redirect(portalUrl);
  }

  // DELETE /api/wearables/devices/:deviceId — disconnect (withdraw + revoke)
  @Delete('devices/:deviceId')
  @UseGuards(ConsentGuard)
  disconnect(@Param('deviceId') deviceId: string, @Req() req: PatientRequest) {
    return this.wearables.disconnect(req.patientToken ?? '', deviceId);
  }

  // GET /api/wearables/devices/:deviceId/readings
  @Get('devices/:deviceId/readings')
  @UseGuards(ConsentGuard)
  readings(
    @Param('deviceId') deviceId: string,
    @Query('limit') limit: string | undefined,
    @Req() req: PatientRequest,
  ) {
    const n = limit ? Number.parseInt(limit, 10) : 50;
    return this.wearables.getReadings(req.patientToken ?? '', deviceId, Number.isNaN(n) ? 50 : n);
  }

  // POST /api/wearables/devices/:deviceId/sync — enqueue + run a sync job
  @Post('devices/:deviceId/sync')
  @UseGuards(ConsentGuard)
  sync(@Param('deviceId') deviceId: string, @Req() req: PatientRequest) {
    return this.wearables.sync(req.patientToken ?? '', deviceId);
  }

  // GET /api/wearables/devices/:deviceId/sync/:jobId — poll a sync job
  @Get('devices/:deviceId/sync/:jobId')
  @UseGuards(ConsentGuard)
  syncJob(
    @Param('deviceId') deviceId: string,
    @Param('jobId') jobId: string,
    @Req() req: PatientRequest,
  ) {
    return this.wearables.getSyncJob(req.patientToken ?? '', deviceId, jobId);
  }

  // PUT /api/wearables/devices/:deviceId/consent — toggle physician_sharing | his_export
  @Put('devices/:deviceId/consent')
  @UseGuards(ConsentGuard)
  updateConsent(
    @Param('deviceId') deviceId: string,
    @Body() body: ConsentUpdatePayload,
    @Req() req: PatientRequest,
  ) {
    if (!body || (body.type !== 'physician_sharing' && body.type !== 'his_export')) {
      throw new BadRequestException('INVALID_CONSENT_TYPE');
    }
    return this.wearables.updateConsent(req.patientToken ?? '', deviceId, body, ipHashOf(req));
  }

  // GET /api/wearables/devices/:deviceId/consents — current consent state
  @Get('devices/:deviceId/consents')
  @UseGuards(ConsentGuard)
  consents(@Param('deviceId') deviceId: string, @Req() req: PatientRequest) {
    return this.wearables.getConsent(req.patientToken ?? '', deviceId);
  }

  // GET /api/wearables/consents/audit?deviceId= — append-only consent audit trail
  @Get('consents/audit')
  @UseGuards(ConsentGuard)
  consentAudit(@Query('deviceId') deviceId: string | undefined, @Req() req: PatientRequest) {
    return this.wearables.getConsentAuditLog(req.patientToken ?? '', deviceId || undefined);
  }

  // POST /api/wearables/:platform/upload — manual upload (AliveCor PDF / Xiaomi zip)
  @Post(':platform/upload')
  @UseGuards(ConsentGuard)
  upload(
    @Param('platform') platform: string,
    @Body() body: { filename?: string; size?: number } | undefined,
    @Req() req: PatientRequest,
  ) {
    return this.wearables.upload(req.patientToken ?? '', platform, {
      originalname: body?.filename,
      size: body?.size,
    });
  }

  // GET /api/wearables/notifications?type= — patient alert inbox (bell)
  @Get('notifications')
  @UseGuards(ConsentGuard)
  notifications(@Query('type') type: string | undefined, @Req() req: PatientRequest) {
    return this.wearables.listNotifications(req.patientToken ?? '', type || undefined);
  }

  // GET /api/wearables/notifications/unread-count?type=
  @Get('notifications/unread-count')
  @UseGuards(ConsentGuard)
  async unread(@Query('type') type: string | undefined, @Req() req: PatientRequest) {
    return { count: await this.wearables.unreadCount(req.patientToken ?? '', type || undefined) };
  }

  // PATCH /api/wearables/notifications/read-all?type=
  @Patch('notifications/read-all')
  @UseGuards(ConsentGuard)
  readAll(@Query('type') type: string | undefined, @Req() req: PatientRequest) {
    return this.wearables.markNotificationsRead(req.patientToken ?? '', type || undefined);
  }

  // POST /api/wearables/devices/:deviceId/readings — admin/test injection (staff JWT)
  @Post('devices/:deviceId/readings')
  @UseGuards(AuthGuard('jwt'))
  injectReading(
    @Param('deviceId') deviceId: string,
    @Body() body: { metricType: string; value: number; unit?: string },
  ) {
    return this.wearables.injectReading(deviceId, body);
  }

  // POST /api/wearables/devices/:deviceId/export-fhir — manual FHIR export (staff JWT)
  @Post('devices/:deviceId/export-fhir')
  @UseGuards(AuthGuard('jwt'))
  exportFhir(@Param('deviceId') deviceId: string) {
    return this.wearables.requestFhirExport(deviceId);
  }

  // GET /api/wearables/physician/:patientToken — clinician summary (staff JWT)
  @Get('physician/:patientToken')
  @UseGuards(AuthGuard('jwt'))
  physicianView(@Param('patientToken') patientToken: string, @Req() req: StaffRequest) {
    return this.wearables.physicianView(patientToken, req.user.userId);
  }

  // PUT /api/wearables/physician/:patientToken/thresholds — clinician role only
  @Put('physician/:patientToken/thresholds')
  @UseGuards(AuthGuard('jwt'))
  setThresholds(
    @Param('patientToken') patientToken: string,
    @Body() body: { metricType: string; high?: number | null; low?: number | null; criticalHigh?: number | null; criticalLow?: number | null },
    @Req() req: StaffRequest,
  ) {
    return this.wearables.setThresholds(patientToken, req.user.userId, req.user.role, body.metricType, body);
  }
}
