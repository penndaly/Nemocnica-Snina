/**
 * Payment gateway service — PCI-compliant hosted-fields / redirect pattern.
 *
 * Card data NEVER touches our servers. The client renders the gateway's
 * hosted field iframe; we only handle:
 *   1. Creating a payment session (returns a hosted-fields token)
 *   2. Receiving webhooks on payment completion/failure/refund (idempotent)
 *   3. Issuing receipts and recording transaction metadata (no PAN)
 *
 * Two paid scenarios:
 *   A. LSPP fee (€1.99) — General Surgery emergency-use charge
 *   B. Medical certificates / documents (amount varies)
 *
 * All transactions are logged to audit_log.
 * PAYMENT_PROVIDER=mock in dev → returns a fake session token.
 */
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { randomUUID } from 'crypto';
import * as crypto from 'crypto';

export interface CreateSessionDto {
  amount:      number;  // in EUR cents, e.g. 199 for €1.99
  currency:    'EUR';
  description: string;  // "LSPP General Surgery" | "Medical certificate"
  locale:      string;
  successUrl:  string;
  cancelUrl:   string;
  metadata:    Record<string, string>;
}

export interface PaymentSession {
  sessionId:   string;
  publicKey:   string;   // gateway publishable key for iframe
  hostedUrl:   string;   // hosted-fields iframe URL
}

export interface WebhookEvent {
  event:        'payment.completed' | 'payment.failed' | 'payment.refunded';
  sessionId:    string;
  amount:       number;
  currency:     string;
  idempotencyKey: string;
  metadata:     Record<string, string>;
}

// Prisma model for transaction log (no PAN — just metadata)
// In production add a `payments` table to the Prisma schema.
// For now we persist to audit_log as a transaction event.

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly provider: string;
  private readonly secretKey: string;
  private readonly webhookSecret: string;
  private readonly lsspFee: number;

  constructor(
    private readonly cfg: ConfigService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {
    this.provider     = cfg.get<string>('PAYMENT_PROVIDER')       ?? 'mock';
    this.secretKey    = cfg.get<string>('PAYMENT_SECRET_KEY')     ?? '';
    this.webhookSecret= cfg.get<string>('PAYMENT_WEBHOOK_SECRET') ?? '';
    this.lsspFee      = Math.round(parseFloat(cfg.get<string>('LSPP_FEE_EUR') ?? '1.99') * 100);
  }

  // ── Create payment session ────────────────────────────────

  async createSession(dto: CreateSessionDto): Promise<PaymentSession> {
    if (dto.amount < 1) throw new BadRequestException('Amount must be at least 1 cent');

    if (this.provider === 'mock') {
      const mockId = `mock_session_${randomUUID()}`;
      this.logger.log(`[payments mock] session ${mockId} for €${(dto.amount / 100).toFixed(2)}`);
      return {
        sessionId: mockId,
        publicKey: 'pk_mock_public',
        hostedUrl: `http://localhost:3000/mock-payment?session=${mockId}`,
      };
    }

    // Real gateway implementation (example: Stripe-compatible API)
    const gatewayUrl = `https://api.${this.provider}.com/v1/checkout/sessions`;
    const res = await fetch(gatewayUrl, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        Authorization:   `Bearer ${this.secretKey}`,
      },
      body: JSON.stringify({
        amount:            dto.amount,
        currency:          dto.currency,
        description:       dto.description,
        success_url:       dto.successUrl,
        cancel_url:        dto.cancelUrl,
        metadata:          dto.metadata,
        payment_method_types: ['card'],
      }),
    });

    if (!res.ok) throw new Error(`Payment gateway error: ${res.status} ${await res.text()}`);
    const data = await res.json() as { id: string; url: string };

    return {
      sessionId: data.id,
      publicKey: this.cfg.get<string>('PAYMENT_PUBLIC_KEY') ?? '',
      hostedUrl: data.url,
    };
  }

  // ── LSPP convenience method ───────────────────────────────

  async createLsspSession(
    bookingId: string,
    locale: string,
    baseUrl: string,
  ): Promise<PaymentSession> {
    return this.createSession({
      amount:      this.lsspFee,
      currency:    'EUR',
      description: 'Poplatok za pohotovostné použitie (LSPP) — General Surgery',
      locale,
      successUrl:  `${baseUrl}/${locale}/objednanie/platba-ok?booking=${bookingId}`,
      cancelUrl:   `${baseUrl}/${locale}/objednanie/platba-zrusena?booking=${bookingId}`,
      metadata:    { bookingId },
    });
  }

  // ── Webhook handler (idempotent) ──────────────────────────

  verifyWebhookSignature(rawBody: string, signature: string): void {
    if (this.provider === 'mock') return; // skip verification in dev
    const expected = `sha256=${crypto
      .createHmac('sha256', this.webhookSecret)
      .update(rawBody)
      .digest('hex')}`;
    // Constant-time compare to avoid a timing side-channel on the webhook HMAC.
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      throw new BadRequestException('Invalid webhook signature');
    }
  }

  async handleWebhook(event: WebhookEvent): Promise<void> {
    this.logger.log(`Payment webhook: ${event.event} ${event.sessionId} €${(event.amount / 100).toFixed(2)}`);

    await this.audit.log({
      actorEmail: 'system:payment-gateway',
      actorRole:  'system',
      action:     `payment.${event.event}`,
      resource:   'payment',
      resourceId: event.sessionId,
      detail: {
        amount:    event.amount,
        currency:  event.currency,
        bookingId: event.metadata['bookingId'],
      },
    });

    if (event.event === 'payment.completed') {
      const pdfContent = this.generateReceiptPdf({
        transactionRef: event.sessionId,
        description:    event.idempotencyKey || 'Nemocnica Snina — platba',
        amount:         event.amount,
        currency:       event.currency,
        bookingId:      event.metadata['bookingId'],
        date:           new Date(),
      });

      await this.prisma.paymentReceipt.upsert({
        where:  { transactionRef: event.sessionId },
        create: {
          id:             randomUUID(),
          transactionRef: event.sessionId,
          bookingId:      event.metadata['bookingId'] ?? null,
          pdfContent: new Uint8Array(pdfContent),
        },
        update: {}, // idempotent — first write wins
      });
    }
  }

  async getReceiptPdf(transactionRef: string): Promise<Buffer | null> {
    const receipt = await this.prisma.paymentReceipt.findUnique({
      where: { transactionRef },
      select: { pdfContent: true },
    });
    if (!receipt?.pdfContent) return null;
    return Buffer.from(receipt.pdfContent);
  }

  private generateReceiptPdf(opts: {
    transactionRef: string;
    description:    string;
    amount:         number;
    currency:       string;
    bookingId?:     string;
    date:           Date;
  }): Buffer {
    const amountFormatted = `${(opts.amount / 100).toFixed(2)} ${opts.currency}`;
    const dateStr = opts.date.toISOString().substring(0, 10);
    const lines = [
      `NEMOCNICA SNINA, s.r.o.`,
      `Sladkovicova 300/3, 069 01 Snina`,
      `ICO: 52379571  DIC: 2121029041`,
      ``,
      `POKLADNICNY DOKLAD / RECEIPT`,
      ``,
      `Datum / Date:          ${dateStr}`,
      `Transakcia / Tx ref:   ${opts.transactionRef}`,
      `Popis / Description:   ${opts.description}`,
      opts.bookingId ? `Rezervacia / Booking:  ${opts.bookingId}` : ``,
      ``,
      `Suma / Amount:         ${amountFormatted}`,
      ``,
      `Dakujeme za platbu. / Thank you for your payment.`,
    ].filter((l) => l !== undefined);

    const textContent = lines.join('\n');
    // Minimal but valid PDF — single page, monospaced text
    const streamContent = lines
      .map((line, i) => `BT /F1 10 Tf 50 ${750 - i * 15} Td (${line.replace(/[()\\]/g, '\\$&')}) Tj ET`)
      .join('\n');
    const streamLen = Buffer.byteLength(streamContent, 'utf-8');

    const pdf = [
      `%PDF-1.4`,
      `1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj`,
      `2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj`,
      `3 0 obj<</Type/Page/MediaBox[0 0 595 842]/Parent 2 0 R`,
      `  /Resources<</Font<</F1<</Type/Font/Subtype/Type1/BaseFont/Courier>>>>>>/Contents 4 0 R>>endobj`,
      `4 0 obj<</Length ${streamLen}>>`,
      `stream`,
      streamContent,
      `endstream`,
      `endobj`,
      `xref`,
      `0 5`,
      `0000000000 65535 f `,
      `0000000009 00000 n `,
      `trailer<</Size 5/Root 1 0 R>>`,
      `startxref`,
      `0`,
      `%%EOF`,
    ].join('\n');

    void textContent; // silence unused warning
    return Buffer.from(pdf, 'utf-8');
  }
}
