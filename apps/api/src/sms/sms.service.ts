/**
 * SMS service — OTP verification + booking confirmations/reminders/cancellations.
 * Pluggable: swap the sendSms() implementation for any SK/EU gateway.
 * Currently stubs to console in development; wire to real gateway via env.
 *
 * OTP flow:
 *   1. Client calls POST /api/sms/otp  { phone, purpose }
 *   2. Server hashes code, stores in sms_otps with 10-min TTL
 *   3. Client submits code with booking — server verifies before confirming
 */
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomInt, randomUUID } from 'crypto';

const prisma = new PrismaClient();

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(private readonly cfg: ConfigService) {}

  // ── OTP ───────────────────────────────────────────────────

  async sendOtp(phone: string, purpose: string): Promise<void> {
    const code = String(randomInt(100_000, 999_999));
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.smsOtp.create({
      data: { id: randomUUID(), phone, codeHash, purpose, expiresAt },
    });

    const message =
      purpose === 'booking'
        ? `Nemocnica Snina — overovací kód pre objednávku: ${code}. Platný 10 minút.`
        : `Nemocnica Snina — overovací kód: ${code}. Platný 10 minút.`;

    await this.sendSms(phone, message);
  }

  async verifyOtp(phone: string, code: string, purpose: string): Promise<boolean> {
    const otps = await prisma.smsOtp.findMany({
      where: { phone, purpose, used: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      take: 1,
    });
    if (!otps[0]) return false;

    const valid = await bcrypt.compare(code, otps[0].codeHash);
    if (valid) {
      await prisma.smsOtp.update({ where: { id: otps[0].id }, data: { used: true } });
    }
    return valid;
  }

  // ── Booking lifecycle messages ────────────────────────────

  async sendBookingConfirmation(params: {
    phone: string;
    bookingId: string;
    clinicName: string;
    date: string;
    time: string;
    cancelToken: string;
    locale?: string;
  }): Promise<void> {
    const cancelUrl = `https://nemocnicasnina.sk/${params.locale ?? 'sk'}/objednanie/zrusit/${params.cancelToken}`;
    const message =
      `Nemocnica Snina — potvrdenie objednávky ${params.bookingId}.\n` +
      `${params.clinicName} · ${params.date} ${params.time}.\n` +
      `Zrušiť: ${cancelUrl}`;
    await this.sendSms(params.phone, message);
  }

  async sendBookingReminder(params: {
    phone: string;
    clinicName: string;
    date: string;
    time: string;
  }): Promise<void> {
    const message =
      `Nemocnica Snina — pripomienka: ${params.clinicName} · ${params.date} ${params.time}. ` +
      `Ak nemôžete prísť, zrušte prosím cez odkaz v pôvodnej SMS.`;
    await this.sendSms(params.phone, message);
  }

  async sendBookingCancellation(phone: string, bookingId: string): Promise<void> {
    await this.sendSms(phone, `Nemocnica Snina — objednávka ${bookingId} bola zrušená.`);
  }

  async sendBookingReschedule(phone: string, bookingId: string, date: string, time: string): Promise<void> {
    await this.sendSms(
      phone,
      `Nemocnica Snina — objednávka ${bookingId} bola preobjednaná na ${date} ${time}.`,
    );
  }

  async sendRaw(phone: string, message: string): Promise<void> {
    await this.sendSms(phone, message);
  }

  // ── Gateway call ──────────────────────────────────────────

  private async sendSms(to: string, body: string): Promise<void> {
    const apiKey = this.cfg.get<string>('SMS_API_KEY');

    if (!apiKey) {
      // Development: log only
      this.logger.log(`[SMS → ${to}]: ${body}`);
      return;
    }

    // Production: replace with real gateway (e.g. InfoSMS, Twilio, SMSGlobal)
    const res = await fetch('https://api.smsglobal.com/v2/sms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`,
      },
      body: JSON.stringify({
        destination: to,
        message: body,
        origin: this.cfg.get<string>('SMS_SENDER_ID') ?? 'NemocnicaSN',
      }),
    });

    if (!res.ok) {
      this.logger.error(`SMS gateway error ${res.status}: ${await res.text()}`);
    }
  }
}
