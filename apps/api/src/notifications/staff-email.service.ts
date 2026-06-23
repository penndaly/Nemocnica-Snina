/**
 * Staff email service — invite, password reset, MFA reset, session-revoked.
 *
 * All emails are bilingual (SK primary, EN secondary). Pluggable transport:
 * stubs to the logger in dev (mirrors SmsService); swap sendEmail() for SMTP via
 * env in production. Raw tokens appear only in the email body — never logged.
 *
 * Rate limit: max STAFF_EMAIL_RATE_LIMIT (default 3) token emails per address
 * per hour (invite / password-reset / mfa-reset). Breach → 429.
 */
import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StaffSecurityRedis } from '../auth/staff-security.redis';

const ROLE_LABEL: Record<string, { sk: string; en: string }> = {
  super_admin: { sk: 'Super administrátor', en: 'Super admin' },
  administrator: { sk: 'Administrátor', en: 'Administrator' },
  clinician: { sk: 'Klinický pracovník', en: 'Clinician' },
  editor: { sk: 'Editor', en: 'Editor' },
};

@Injectable()
export class StaffEmailService {
  private readonly logger = new Logger(StaffEmailService.name);
  private readonly adminUrl: string;
  private readonly rateLimit: number;

  constructor(
    private readonly cfg: ConfigService,
    private readonly redis: StaffSecurityRedis,
  ) {
    this.adminUrl = (cfg.get<string>('ADMIN_URL') ?? 'http://localhost:3000/admin').replace(/\/$/, '');
    this.rateLimit = Number(cfg.get('STAFF_EMAIL_RATE_LIMIT') ?? 3);
  }

  /** Enforce the per-address hourly cap for token-bearing emails. */
  private async enforceRateLimit(email: string): Promise<void> {
    const count = await this.redis.incrEmailSend(email);
    if (count > this.rateLimit) {
      throw new HttpException(
        `Email rate limit exceeded (${this.rateLimit}/hour) for ${email}`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  async sendInviteEmail(to: string, name: string, inviteToken: string, role: string): Promise<void> {
    await this.enforceRateLimit(to);
    const label = ROLE_LABEL[role] ?? { sk: role, en: role };
    const link = `${this.adminUrl}/accept-invite?token=${inviteToken}`;
    await this.sendEmail(
      to,
      'Nemocnica Snina — Pozvánka do administrácie / Admin invitation',
      [
        `Dobrý deň ${name},`,
        `boli ste pozvaný/á do administrácie Nemocnice Snina v role: ${label.sk}.`,
        `Pozvánku prijmete tu: ${link}`,
        `Odkaz je platný 72 hodín.`,
        ``,
        `Hello ${name},`,
        `you have been invited to the Nemocnica Snina admin as: ${label.en}.`,
        `Accept your invitation here: ${link}`,
        `This link expires in 72 hours.`,
        ``,
        `IT podpora / IT support: it@nemocnicasnina.sk`,
      ].join('\n'),
    );
  }

  async sendPasswordResetEmail(to: string, name: string, resetToken: string): Promise<void> {
    await this.enforceRateLimit(to);
    const link = `${this.adminUrl}/reset-password?token=${resetToken}`;
    await this.sendEmail(
      to,
      'Nemocnica Snina — Obnovenie hesla / Password reset',
      [
        `Dobrý deň ${name},`,
        `obnoviť heslo môžete tu: ${link}`,
        `Odkaz je platný 30 minút.`,
        `Ak ste o obnovenie nepožiadali, ihneď kontaktujte IT.`,
        ``,
        `Hello ${name},`,
        `reset your password here: ${link}`,
        `This link expires in 30 minutes.`,
        `If you did not request this, contact IT immediately.`,
      ].join('\n'),
    );
  }

  async sendMfaResetEmail(to: string, name: string, resetToken: string): Promise<void> {
    await this.enforceRateLimit(to);
    const link = `${this.adminUrl}/setup-mfa?token=${resetToken}`;
    await this.sendEmail(
      to,
      'Nemocnica Snina — Obnovenie MFA / MFA reset',
      [
        `Dobrý deň ${name},`,
        `vaše dvojfaktorové overenie (MFA) bolo obnovené administrátorom.`,
        `Nastavte si nové MFA tu: ${link}`,
        `Odkaz je platný 30 minút.`,
        ``,
        `Hello ${name},`,
        `your two-factor authentication was reset by an administrator.`,
        `Set up MFA again here: ${link}`,
        `This link expires in 30 minutes.`,
      ].join('\n'),
    );
  }

  /** System notification — not rate-limited (no token, admin-initiated). */
  async sendSessionRevokedEmail(to: string, name: string): Promise<void> {
    await this.sendEmail(
      to,
      'Nemocnica Snina — Relácie zrušené / Sessions revoked',
      [
        `Dobrý deň ${name},`,
        `všetky vaše aktívne administrátorské relácie boli zrušené.`,
        `Ak to nebolo očakávané, ihneď kontaktujte IT.`,
        ``,
        `Hello ${name},`,
        `all your active admin sessions were revoked.`,
        `If this was not expected, contact IT immediately.`,
        `IT: +421 57 7871 200`,
      ].join('\n'),
    );
  }

  /**
   * Transport. Dev: log to console (tokens visible only here, never via logger
   * metadata). Production: replace with an SMTP/provider call.
   */
  private async sendEmail(to: string, subject: string, body: string): Promise<void> {
    this.logger.log(`[staff-email] → ${to} · ${subject}`);
    if (process.env['NODE_ENV'] !== 'production') {
      // eslint-disable-next-line no-console
      console.log(`\n──── STAFF EMAIL (dev) ────\nTo: ${to}\nSubject: ${subject}\n\n${body}\n───────────────────────────\n`);
    }
    // TODO(prod): wire SMTP transport (SMTP_* env from PRODUCTION_ARCHITECTURE.md).
    await Promise.resolve();
  }
}
