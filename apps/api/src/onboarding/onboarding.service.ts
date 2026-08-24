import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { OnboardingStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { validateRodneCislo } from '../common/rc-validation';
import { NcziXmlService } from './nczi-xml.service';
import { AuditService } from '../audit/audit.service';
import { HisQueueService } from '../his/his-queue.service';
import { SmsService } from '../sms/sms.service';
import { RcCryptoService } from '../common/rc-crypto.service';

interface ApplyDto {
  physicianId: string;
  patientName: string;
  patientRc: string;
  insurerCode: string;
  phone: string;
  email?: string;
}

@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ncziXml: NcziXmlService,
    private readonly audit: AuditService,
    private readonly his: HisQueueService,
    private readonly sms: SmsService,
    private readonly cfg: ConfigService,
    private readonly rcCrypto: RcCryptoService,
  ) {}

  async apply(dto: ApplyDto) {
    if (!validateRodneCislo(dto.patientRc)) {
      throw new BadRequestException('Invalid rodné číslo');
    }

    // RC is stored two ways: bcrypt hash (irreversible identity check) and
    // AES-256-GCM ciphertext (decryptable for NCZI eDohoda + GDPR Art.15 export).
    const rcHash = await bcrypt.hash(dto.patientRc, 12);
    const rcEncrypted = this.rcCrypto.encrypt(dto.patientRc);

    const application = await this.prisma.onboardingApplication.create({
      data: {
        id: randomUUID(),
        physicianId: dto.physicianId,
        patientName: dto.patientName,
        patientRcHash: rcHash,
        patientRcEncrypted: rcEncrypted,
        insurerCode: dto.insurerCode,
        phone: dto.phone,
        email: dto.email ?? null,
        status: OnboardingStatus.SUBMITTED,
      },
    });

    return { applicationId: application.id };
  }

  /**
   * Recover the plaintext RC for NCZI eDohoda generation. Throws a descriptive
   * error for pre-fix applications (no encrypted RC) so they are flagged for
   * manual processing rather than silently sent as '[REDACTED]'.
   */
  decryptRcForNczi(app: { id: string; patientRcEncrypted: string | null }): string {
    if (!app.patientRcEncrypted) {
      throw new BadRequestException(
        `Application ${app.id} was submitted before encrypted RC storage was added — ` +
          `no recoverable rodné číslo. NCZI eDohoda cannot be generated automatically; ` +
          `process this application manually.`,
      );
    }
    return this.rcCrypto.decrypt(app.patientRcEncrypted);
  }

  async list() {
    return this.prisma.onboardingApplication.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        physicianId: true,
        patientName: true,
        insurerCode: true,
        phone: true,
        email: true,
        status: true,
        reviewNote: true,
        createdAt: true,
        updatedAt: true,
        // patientRcHash excluded — never expose hash to frontend
        // ncziXmlPayload excluded — sensitive
      },
    });
  }

  async review(
    applicationId: string,
    decision: 'accept' | 'reject',
    reviewerEmail: string,
    reviewerRole: string,
    reviewNote: string,
    ip: string,
  ) {
    if (reviewerRole === 'EDITOR') {
      throw new ForbiddenException('Clinician or Admin role required');
    }

    const app = await this.prisma.onboardingApplication.findUniqueOrThrow({
      where: { id: applicationId },
    });

    if (
      app.status === OnboardingStatus.ACCEPTED ||
      app.status === OnboardingStatus.REJECTED
    ) {
      throw new BadRequestException('Application already reviewed');
    }

    const newStatus =
      decision === 'accept' ? OnboardingStatus.ACCEPTED : OnboardingStatus.REJECTED;

    if (decision === 'accept') {
      const today = new Date();
      const validFrom = today.toISOString().substring(0, 10);
      const validTo = new Date(today.setFullYear(today.getFullYear() + 1))
        .toISOString()
        .substring(0, 10);

      const hospitalIco = this.cfg.get<string>('HOSPITAL_ICO') ?? '52379571';
      const signToken = randomUUID();

      // Recover the plaintext RC (AES-256-GCM) for the NCZI eDohoda payload.
      // Pre-fix applications have no encrypted RC → cannot be auto-processed.
      let patientRc: string;
      try {
        patientRc = this.decryptRcForNczi(app);
      } catch (err) {
        await this.audit.log({
          actorEmail: reviewerEmail,
          actorRole: reviewerRole,
          action: 'onboarding_manual_required',
          resource: 'onboarding_application',
          resourceId: applicationId,
          detail: { reason: 'no_encrypted_rc' },
        });
        throw err;
      }

      const xml = this.ncziXml.generateEDohoda({
        patientRc,
        insurerCode: app.insurerCode,
        doctorCode: app.physicianId,
        hospitalIco,
        validFrom,
        validTo,
      });

      // The generated XML necessarily embeds the plaintext RC (NCZI's own
      // eDohoda schema requires it) — encrypt before persisting so it's never
      // at rest in plaintext, matching patientRcEncrypted's treatment. Never
      // read back elsewhere in the app (review() returns the in-memory `xml`
      // directly), so no decrypt-on-read path is needed.
      await this.prisma.onboardingApplication.update({
        where: { id: applicationId },
        data: { status: newStatus, reviewNote, ncziXmlPayload: this.rcCrypto.encrypt(xml), signToken },
      });

      await this.his.publish({
        type: 'onboarding.accepted',
        idempotencyKey: applicationId,
        payload: {
          applicationId,
          physicianId: app.physicianId,
          insurerCode: app.insurerCode,
          ncziXmlPayload: xml,
          validFrom,
          validTo,
        },
        timestamp: new Date().toISOString(),
      });

      await this.audit.log({
        actorEmail: reviewerEmail,
        actorRole: reviewerRole,
        action: 'onboarding_accept',
        resource: 'onboarding_application',
        resourceId: applicationId,
        detail: { reviewNote, physicianId: app.physicianId, validFrom, validTo },
        ip,
      });

      const baseUrl = this.cfg.get<string>('APP_BASE_URL') ?? 'https://nemocnicasnina.sk';
      const signingLinkSk = `${baseUrl}/sk/registracia/podpis?token=${signToken}`;
      const signingLinkEn = `${baseUrl}/en/registracia/podpis?token=${signToken}`;

      await this.sms.sendRaw(
        app.phone,
        `Nemocnica Snina — Vaša žiadosť o registráciu u MUDr. ${app.physicianId} bola schválená. ` +
          `Podpíšte digitálnu dohodu cez Slovensko.sk eID: ${signingLinkSk}`,
      );

      return { status: newStatus, edohodaXml: xml };
    } else {
      await this.prisma.onboardingApplication.update({
        where: { id: applicationId },
        data: { status: newStatus, reviewNote },
      });

      await this.audit.log({
        actorEmail: reviewerEmail,
        actorRole: reviewerRole,
        action: 'onboarding_reject',
        resource: 'onboarding_application',
        resourceId: applicationId,
        detail: { reviewNote, physicianId: app.physicianId },
        ip,
      });

      await this.sms.sendRaw(
        app.phone,
        `Nemocnica Snina — Vaša žiadosť o registráciu bola zamietnutá. ` +
          `Dôvod: ${reviewNote || 'neuvedený'}. Pre viac informácií kontaktujte recepciu: +421 57 766 01 11.`,
      );

      return { status: newStatus };
    }
  }
}
