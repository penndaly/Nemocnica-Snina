import {
  Body, Controller, Get, Headers, HttpCode,
  NotFoundException, Param, Post, RawBody, Request, Res,
  UnauthorizedException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { FastifyReply } from 'fastify';
import * as jose from 'jose';
import { ConfigService } from '@nestjs/config';
import { PaymentsService, WebhookEvent } from './payments.service';
import { AuditService } from '../audit/audit.service';

@Controller('api/payments')
export class PaymentsController {
  private readonly sessionSecret: Uint8Array;

  constructor(
    private readonly payments: PaymentsService,
    private readonly audit: AuditService,
    cfg: ConfigService,
  ) {
    this.sessionSecret = new TextEncoder().encode(
      cfg.get<string>('JWT_SECRET') ?? 'dev-secret-min-32-chars-long-xxx',
    );
  }

  @Post('session/lspp')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  async createLsspSession(
    @Body() body: { bookingId: string; locale: string },
    @Request() req: { headers: { host?: string }; protocol?: string },
  ) {
    const baseUrl = `${req.protocol ?? 'https'}://${req.headers.host ?? 'localhost:3000'}`;
    return this.payments.createLsspSession(body.bookingId, body.locale ?? 'sk', baseUrl);
  }

  @Post('webhook')
  @HttpCode(200)
  async webhook(
    @Body() body: Record<string, unknown>,
    @RawBody() rawBody: Buffer,
    @Headers('x-payment-signature') sig: string,
  ) {
    this.payments.verifyWebhookSignature(rawBody.toString(), sig ?? '');
    await this.payments.handleWebhook(body as unknown as WebhookEvent);
    return { received: true };
  }

  /**
   * GET /api/payments/receipt/:transactionRef
   * Patient session required (no step-up 2FA). Audited.
   */
  @Get('receipt/:transactionRef')
  async downloadReceipt(
    @Param('transactionRef') transactionRef: string,
    @Headers('x-patient-session') sessionToken: string | undefined,
    @Headers('x-forwarded-for') forwardedFor: string | undefined,
    @Res() reply: FastifyReply,
  ) {
    if (!sessionToken) throw new UnauthorizedException('Patient session required');

    let patientSub: string;
    try {
      const { payload } = await jose.jwtVerify(sessionToken, this.sessionSecret, { audience: 'ns.patient' });
      patientSub = String(payload['sub'] ?? '');
    } catch {
      throw new UnauthorizedException('Invalid or expired patient session');
    }

    const pdf = await this.payments.getReceiptPdf(transactionRef);
    if (!pdf) throw new NotFoundException('Receipt not found');

    await this.audit.log({
      actorEmail: `patient:${patientSub.slice(0, 8)}`,
      actorRole: 'patient',
      action: 'payment_receipt_downloaded',
      resource: 'payment_receipt',
      resourceId: transactionRef,
      ip: forwardedFor ?? 'unknown',
    });

    return reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `attachment; filename="receipt-${transactionRef}.pdf"`)
      .send(pdf);
  }
}
