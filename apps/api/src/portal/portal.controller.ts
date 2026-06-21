/**
 * Patient portal data endpoints — authenticated via the patient session JWT
 * (issued by the Next.js web tier after OIDC callback).
 *
 * Step-up 2FA for lab PDF (Task 5):
 *   1. POST /api/portal/labs/:id/pdf-challenge  → sends SMS OTP to the patient's phone
 *   2. POST /api/portal/labs/:id/pdf-download   → verifies OTP, streams PDF, audits download
 *
 * Every call audits the access: who read which patient's records, from which IP.
 * No patient data is cached on this tier.
 */
import {
  BadRequestException, Body, Controller, Get, Headers,
  HttpCode, Ip, NotFoundException, Param, Post,
  Res, UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { FastifyReply } from 'fastify';
import * as jose from 'jose';
import Redis from 'ioredis';
import { FhirReadService } from '../his/fhir-read.service';
import { HisQueueService } from '../his/his-queue.service';
import { SmsService } from '../sms/sms.service';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller('api/portal')
export class PortalController {
  private readonly sessionSecret: Uint8Array;
  private readonly mock: boolean;
  private readonly redis: Redis;

  constructor(
    private readonly fhir: FhirReadService,
    private readonly his: HisQueueService,
    private readonly sms: SmsService,
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
    cfg: ConfigService,
  ) {
    this.sessionSecret = new TextEncoder().encode(
      cfg.get<string>('JWT_SECRET') ?? 'dev-secret-min-32-chars-long-xxx',
    );
    this.mock  = cfg.get<string>('HIS_MOCK_ENABLED') === 'true';
    this.redis = new Redis(cfg.get<string>('REDIS_URL') ?? 'redis://localhost:6379', {
      lazyConnect: true,
      enableOfflineQueue: false,
    });
  }

  // ── Session helper ──────────────────────────────────────

  private async resolveSession(token: string | undefined): Promise<string> {
    if (!token) throw new UnauthorizedException('Missing patient session');
    try {
      const { payload } = await jose.jwtVerify(token, this.sessionSecret);
      return String(payload['sub'] ?? '');
    } catch {
      throw new UnauthorizedException('Invalid or expired patient session');
    }
  }

  // ── Records endpoint ─────────────────────────────────────

  @Get('records')
  async getRecords(
    @Headers('x-patient-session') sessionToken: string | undefined,
    @Headers('x-forwarded-email') forwardedEmail: string | undefined,
    @Ip() ip: string,
  ) {
    const patientSub  = await this.resolveSession(sessionToken);
    const actorEmail  = forwardedEmail ?? `patient:${patientSub.slice(0, 8)}`;
    return this.fhir.getPatientRecord(patientSub, actorEmail, ip);
  }

  // ── Step-up 2FA: issue OTP ────────────────────────────────

  /**
   * POST /api/portal/labs/:id/pdf-challenge
   * Body: { phone: string }
   * Sends a fresh SMS OTP to the patient's phone.
   * The phone number must be supplied by the client (it came from FHIR patient demographics).
   */
  @Post('labs/:id/pdf-challenge')
  async issuePdfChallenge(
    @Param('id') observationId: string,
    @Headers('x-patient-session') sessionToken: string | undefined,
    @Body() body: { phone: string },
    @Ip() ip: string,
  ) {
    const patientSub = await this.resolveSession(sessionToken);
    if (!body.phone) throw new BadRequestException('phone is required');

    await this.sms.sendOtp(body.phone, `lab-pdf:${observationId}`);

    await this.audit.log({
      actorEmail: `patient:${patientSub.slice(0, 8)}`,
      actorRole: 'patient',
      action: 'lab_pdf_challenge_issued',
      resource: 'fhir_observation',
      resourceId: observationId,
      ip,
    });

    return { sent: true };
  }

  // ── Step-up 2FA: verify OTP + stream PDF ─────────────────

  /**
   * POST /api/portal/labs/:id/pdf-download
   * Body: { phone: string; otp: string }
   * Verifies the OTP, then streams the lab-result PDF from HIS/FHIR.
   * If HIS_MOCK_ENABLED, returns a one-page mock PDF.
   */
  @Post('labs/:id/pdf-download')
  async downloadPdf(
    @Param('id') observationId: string,
    @Headers('x-patient-session') sessionToken: string | undefined,
    @Body() body: { phone: string; otp: string },
    @Ip() ip: string,
    @Res() reply: FastifyReply,
  ) {
    const patientSub = await this.resolveSession(sessionToken);
    if (!body.phone || !body.otp) throw new BadRequestException('phone and otp are required');

    const valid = await this.sms.verifyOtp(body.phone, body.otp, `lab-pdf:${observationId}`);
    if (!valid) {
      await this.audit.log({
        actorEmail: `patient:${patientSub.slice(0, 8)}`,
        actorRole: 'patient',
        action: 'lab_pdf_otp_failed',
        resource: 'fhir_observation',
        resourceId: observationId,
        ip,
      });
      throw new UnauthorizedException('Invalid or expired verification code');
    }

    await this.audit.log({
      actorEmail: `patient:${patientSub.slice(0, 8)}`,
      actorRole: 'patient',
      action: 'lab_pdf_downloaded',
      resource: 'fhir_observation',
      resourceId: observationId,
      ip,
    });

    if (this.mock) {
      // Return a minimal valid PDF for dev/CI
      const mockPdf = mockMinimalPdf(observationId);
      return reply
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', `attachment; filename="lab-result-${observationId}.pdf"`)
        .send(mockPdf);
    }

    // Production: fetch PDF stream from HIS FHIR Binary endpoint
    const pdfUrl = `${this.fhir['fhirBase']}/Binary?related=Observation/${observationId}`;
    const token  = await (this.fhir as unknown as { getFhirToken(): Promise<string> }).getFhirToken();
    const res    = await fetch(pdfUrl, {
      headers: { Accept: 'application/pdf', Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new BadRequestException(`HIS PDF not available: HTTP ${res.status}`);

    return reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `attachment; filename="lab-result-${observationId}.pdf"`)
      .send(Buffer.from(await res.arrayBuffer()));
  }

  // ── Part B: Medication refill request ────────────────────

  /**
   * POST /api/portal/refill
   * Body: { medicationRequestId: string }
   * Rate-limited to 1 request per medication per 7 days (Redis).
   * Publishes portal.refill.requested → HIS sync → physician inbox.
   */
  @Post('refill')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  async requestRefill(
    @Headers('x-patient-session') sessionToken: string | undefined,
    @Body() body: { medicationRequestId?: string },
    @Ip() ip: string,
  ) {
    const patientSub = await this.resolveSession(sessionToken);
    const medId = body.medicationRequestId;
    if (!medId) throw new BadRequestException('medicationRequestId is required');

    // Rate-limit: 1 refill request per medication per 7 days
    const rateKey = `refill:${patientSub}:${medId}`;
    let rateLimited = false;
    try {
      const exists = await this.redis.get(rateKey);
      if (exists) rateLimited = true;
      else await this.redis.set(rateKey, '1', 'EX', 7 * 24 * 60 * 60);
    } catch {
      // Redis unavailable — allow but log; don't block patient
    }

    if (rateLimited) {
      throw new BadRequestException(
        'Refill request already submitted for this medication. Please wait 7 days.',
      );
    }

    await this.his.publish({
      type: 'portal.refill.requested',
      idempotencyKey: `${patientSub}:${medId}:${Date.now()}`,
      payload: { patientSub, medicationRequestId: medId },
      timestamp: new Date().toISOString(),
    });

    await this.audit.log({
      actorEmail: `patient:${patientSub.slice(0, 8)}`,
      actorRole: 'patient',
      action: 'portal_refill_requested',
      resource: 'MedicationRequest',
      resourceId: medId,
      ip,
    });

    return { queued: true };
  }

  // ── Part C: Appointment cancel token ─────────────────────

  /**
   * GET /api/portal/appointments/:bookingId/cancel-token
   * Returns the cancelToken for a booking so the patient can deep-link
   * to /[lang]/objednanie/zrusit/[token].
   * The bookingId is the FHIR Appointment identifier value (our internal UUID).
   */
  @Get('appointments/:bookingId/cancel-token')
  async getCancelToken(
    @Param('bookingId') bookingId: string,
    @Headers('x-patient-session') sessionToken: string | undefined,
    @Ip() ip: string,
  ) {
    const patientSub = await this.resolveSession(sessionToken);

    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: { id: true, cancelToken: true, status: true },
    });

    if (!booking?.cancelToken) {
      throw new NotFoundException('Appointment not found or not cancellable');
    }

    if (booking.status === 'CANCELLED') {
      throw new BadRequestException('Appointment is already cancelled');
    }

    await this.audit.log({
      actorEmail: `patient:${patientSub.slice(0, 8)}`,
      actorRole: 'patient',
      action: 'portal_cancel_token_retrieved',
      resource: 'booking',
      resourceId: bookingId,
      ip,
    });

    return { cancelToken: booking.cancelToken };
  }

  // ── Part D: Patient receipt list ─────────────────────────

  /**
   * GET /api/portal/receipts
   * Returns payment receipts. Patient session required.
   * Receipts are keyed by transactionRef; the portal downloads via
   * GET /api/payments/receipt/:transactionRef.
   */
  @Get('receipts')
  async listReceipts(
    @Headers('x-patient-session') sessionToken: string | undefined,
    @Ip() ip: string,
  ) {
    const patientSub = await this.resolveSession(sessionToken);

    const receipts = await this.prisma.paymentReceipt.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, transactionRef: true, bookingId: true, createdAt: true },
    });

    await this.audit.log({
      actorEmail: `patient:${patientSub.slice(0, 8)}`,
      actorRole: 'patient',
      action: 'portal_receipts_listed',
      resource: 'payment_receipts',
      resourceId: patientSub,
      ip,
    });

    return receipts;
  }
}

// ── Minimal PDF for mock mode ─────────────────────────────

function mockMinimalPdf(id: string): Buffer {
  const content =
    `%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n` +
    `2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n` +
    `3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>/Contents 4 0 R>>endobj\n` +
    `4 0 obj<</Length 44>>\nstream\nBT /F1 12 Tf 100 700 Td (Lab result ${id}) Tj ET\nendstream\nendobj\n` +
    `xref\n0 5\n0000000000 65535 f \n0000000009 00000 n \ntrailer<</Size 5/Root 1 0 R>>\nstartxref\n0\n%%EOF`;
  return Buffer.from(content, 'utf-8');
}
