import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TelehealthStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { HisQueueService } from '../his/his-queue.service';
import { VIDEO_PROVIDER, VideoProviderService } from './video-provider.interface';

// Fixed physician identity for E2E fixtures — must match the `sub` claim
// baked into TEST_STAFF_JWT by apps/web/e2e/global-setup.ts, since
// admitPatient/endSession/cancelSession/submitIntake enforce
// session.physicianId === caller.userId with no ADMIN bypass for admit.
export const E2E_TEST_PHYSICIAN_ID = 'e2e-physician-1';

export interface CreateSessionDto {
  bookingId: string;
  clinicId: string;
  physicianId: string;
  scheduledAt: Date;
}

/** The authenticated caller (from the JWT) for per-session authorization. */
export interface TelehealthCaller {
  userId?: string;
  role?: string;
}

export interface JoinResult {
  token: string;
  wsUrl: string;
  roomId: string;
  sessionId: string;
}

export interface IntakeDto {
  reason: string;
  currentMedications: string;
  symptoms: string;
  vitalsNote?: string;
}

export interface SummaryDto {
  clinicalNote: string;
  followUpRecommendationSk?: string;
  followUpRecommendationEn?: string;
  prescriptionIssued?: boolean;
  prescriptionRef?: string;
}

// Legal status transitions (mirrored from DB trigger for application-layer enforcement)
const ALLOWED_TRANSITIONS: Partial<Record<TelehealthStatus, TelehealthStatus[]>> = {
  scheduled: ['waiting', 'no_show', 'cancelled'],
  waiting:   ['active', 'cancelled'],
  active:    ['ended', 'cancelled'],
};

function isTransitionAllowed(from: TelehealthStatus, to: TelehealthStatus): boolean {
  if (from === to) return true;
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

@Injectable()
export class TelehealthSessionService {
  private readonly logger = new Logger(TelehealthSessionService.name);
  private readonly wsUrl: string;
  private readonly ttlSeconds: number;
  private readonly joinWindowSeconds: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly his: HisQueueService,
    private readonly cfg: ConfigService,
    @Inject(VIDEO_PROVIDER) private readonly videoProvider: VideoProviderService,
  ) {
    this.wsUrl           = cfg.get<string>('LIVEKIT_URL') ?? 'wss://livekit.example.eu';
    this.ttlSeconds      = cfg.get<number>('TELEHEALTH_SESSION_TTL_SECONDS') ?? 3600;
    this.joinWindowSeconds = cfg.get<number>('TELEHEALTH_JOIN_WINDOW_SECONDS') ?? 600;
  }

  /**
   * Authorization for per-session staff access (IDOR guard). A clinician may only
   * read/act on sessions they are assigned to (same binding admitPatient uses:
   * session.physicianId === the staff userId); ADMIN is allowed for oversight.
   * Patient callers carry no staff role and are not bound here — session ids are
   * unguessable UUIDs, and the patientToken is session-scoped random (not the
   * patient's identity), so patient↔session binding is a separate documented gap.
   */
  private assertSessionAccess(session: { physicianId: string }, caller?: TelehealthCaller): void {
    if (!caller) return;
    const role = (caller.role ?? '').toUpperCase();
    if (role === 'ADMIN') return;
    if (role === 'CLINICIAN' && session.physicianId !== caller.userId) {
      throw new ForbiddenException('Not the assigned physician for this session');
    }
  }

  // Called when a telehealth booking is confirmed — creates session + LiveKit room
  async createSession(dto: CreateSessionDto): Promise<string> {
    const sessionId  = randomUUID();
    const roomName   = `ns-th-${sessionId}`;
    const providerId = await this.videoProvider.createRoom(roomName);

    await this.prisma.telehealthSession.create({
      data: {
        id:             sessionId,
        bookingId:      dto.bookingId,
        clinicId:       dto.clinicId,
        physicianId:    dto.physicianId,
        patientToken:   randomUUID(),  // opaque session-scoped token; not an RČ
        scheduledAt:    dto.scheduledAt,
        status:         TelehealthStatus.scheduled,
        videoProvider:  this.cfg.get<string>('TELEHEALTH_PROVIDER') ?? 'livekit',
        providerRoomId: providerId,
      },
    });

    await this.audit.log({
      actorEmail: 'system',
      actorRole:  'system',
      action:     'telehealth.session.created',
      resource:   'telehealth_session',
      resourceId: sessionId,
      detail:     { bookingId: dto.bookingId, clinicId: dto.clinicId },
    });

    this.logger.log(`Session created: ${sessionId} for booking ${dto.bookingId}`);
    return sessionId;
  }

  /**
   * E2E fixture only — creates a Booking + BookingConsent + TelehealthSession
   * in one shot at an arbitrary starting status, bypassing the normal
   * booking→confirmed→createSession flow. Never exposed outside the
   * NODE_ENV!==production, secret-gated test controller.
   */
  async seedTestSession(
    clinicId: string,
    status: TelehealthStatus,
    withConsent: boolean,
  ): Promise<{ sessionId: string; bookingId: string; patientToken: string }> {
    const bookingId = randomUUID();
    const now = new Date();

    await this.prisma.booking.create({
      data: {
        id:              bookingId,
        clinicId,
        patientName:     'E2E Test Patient',
        patientPhone:    '+421900000000',
        patientRcHash:   'e2e-fixture-not-a-real-rc-hash',
        date:            now.toISOString().substring(0, 10),
        time:            `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
        mode:            'telehealth',
        status:          'CONFIRMED',
        gdprConsent:     true,
        cancelToken:     randomUUID(),
      },
    });

    await this.prisma.bookingConsent.create({
      data: {
        id:          randomUUID(),
        bookingId,
        consentType: 'telehealth_medical_record',
        granted:     withConsent,
      },
    });

    const sessionId  = randomUUID();
    const roomName   = `ns-th-e2e-${sessionId}`;
    const providerId = await this.videoProvider.createRoom(roomName);
    const patientToken = randomUUID();

    const startedAt = ['waiting', 'active', 'ended'].includes(status) ? now : null;
    const endedAt    = status === 'ended' ? now : null;

    await this.prisma.telehealthSession.create({
      data: {
        id:             sessionId,
        bookingId,
        clinicId,
        physicianId:    E2E_TEST_PHYSICIAN_ID,
        patientToken,
        scheduledAt:    now,
        status,
        startedAt,
        endedAt,
        videoProvider:  this.cfg.get<string>('TELEHEALTH_PROVIDER') ?? 'mock',
        providerRoomId: providerId,
      },
    });

    return { sessionId, bookingId, patientToken };
  }

  async joinSession(
    sessionId: string,
    identity: string,
    role: 'patient' | 'physician',
    ip?: string,
    patientBirthdate?: string,
    caller?: TelehealthCaller,
  ): Promise<JoinResult> {
    const session = await this.prisma.telehealthSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) throw new NotFoundException(`Session ${sessionId} not found`);

    // A physician may only join the session they are assigned to — without this
    // any authenticated clinician could obtain a publish token for any room.
    if (role === 'physician' && (!caller?.userId || session.physicianId !== caller.userId)) {
      throw new ForbiddenException('Not the assigned physician for this session');
    }

    if (session.status === TelehealthStatus.cancelled) {
      throw new ForbiddenException('Session has been cancelled');
    }
    if (session.status === TelehealthStatus.ended) {
      throw new ForbiddenException('Session has already ended');
    }
    if (session.status === TelehealthStatus.no_show) {
      throw new ForbiddenException('Session was marked as no-show');
    }

    // Join window (T6): tokens are only issuable around the scheduled slot — not
    // arbitrarily early, and not for long-past sessions.
    const nowMs = Date.now();
    const scheduledMs = session.scheduledAt.getTime();
    if (nowMs < scheduledMs - this.joinWindowSeconds * 1000) {
      throw new ForbiddenException({ reason: 'too_early', message: 'The join window has not opened yet' });
    }
    if (nowMs > scheduledMs + this.ttlSeconds * 1000) {
      throw new ForbiddenException({ reason: 'window_closed', message: 'The join window has closed' });
    }

    // Consent gate (T3.2/R3): telehealth_medical_record consent required for patient join
    if (role === 'patient') {
      const consentExists = await this.prisma.bookingConsent.findFirst({
        where: {
          bookingId:   session.bookingId,
          consentType: 'telehealth_medical_record',
          granted:     true,
        },
      });
      if (!consentExists) {
        await this.audit.log({
          actorEmail: identity,
          actorRole:  'patient',
          action:     'telehealth.join.blocked.consent_required',
          resource:   'telehealth_session',
          resourceId: sessionId,
          ip,
        });
        throw new ForbiddenException({ reason: 'consent_required', message: 'Telehealth medical record consent not found' });
      }
    }

    // Minor age block (T3.2/R5): patients under 16 may not join teleconsultations
    // eID OIDC provides birthdate claim; in production the OIDC strategy must map it to req.user.birthdate
    if (role === 'patient' && patientBirthdate) {
      const birthYear = new Date(patientBirthdate).getFullYear();
      const age = new Date().getFullYear() - birthYear;
      if (age < 16) {
        await this.audit.log({
          actorEmail: identity,
          actorRole:  'patient',
          action:     'telehealth.join.blocked.minor_under_16',
          resource:   'telehealth_session',
          resourceId: sessionId,
          detail:     { age },
          ip,
        });
        throw new ForbiddenException({ reason: 'minor_blocked', message: 'Telehealth is not available for patients under 16' });
      }
    }

    // Transition patient joining waiting room (scheduled → waiting)
    if (role === 'patient' && session.status === TelehealthStatus.scheduled) {
      await this.transitionStatus(sessionId, TelehealthStatus.waiting, 'system');
    }

    const token = await this.videoProvider.issueToken({
      roomName:     session.providerRoomId,
      identity,
      ttlSeconds:   this.ttlSeconds,
      canPublish:   true,
      canSubscribe: true,
    });

    // Record tokens_issued_at on first issuance
    await this.prisma.telehealthSession.update({
      where: { id: sessionId },
      data:  { tokensIssuedAt: new Date() },
    });

    await this.audit.log({
      actorEmail: identity,
      actorRole:  role,
      action:     'telehealth.token.issued',
      resource:   'telehealth_session',
      resourceId: sessionId,
      detail:     { role },
      ip,
    });

    return {
      token,
      wsUrl:     this.wsUrl,
      roomId:    session.providerRoomId,
      sessionId,
    };
  }

  async admitPatient(sessionId: string, physicianId: string, ip?: string): Promise<void> {
    const session = await this.prisma.telehealthSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException(`Session ${sessionId} not found`);
    if (session.physicianId !== physicianId) {
      throw new ForbiddenException('Only the assigned physician can admit the patient');
    }

    await this.transitionStatus(sessionId, TelehealthStatus.active, physicianId);

    await this.prisma.telehealthSession.update({
      where: { id: sessionId },
      data:  { startedAt: new Date() },
    });

    await this.audit.log({
      actorEmail: physicianId,
      actorRole:  'physician',
      action:     'telehealth.patient.admitted',
      resource:   'telehealth_session',
      resourceId: sessionId,
      ip,
    });
  }

  async endSession(sessionId: string, actorId: string, ip?: string, caller?: TelehealthCaller): Promise<void> {
    const session = await this.prisma.telehealthSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException(`Session ${sessionId} not found`);
    this.assertSessionAccess(session, caller);

    await this.transitionStatus(sessionId, TelehealthStatus.ended, actorId);

    const endedAt  = new Date();
    const duration = session.startedAt
      ? Math.round((endedAt.getTime() - session.startedAt.getTime()) / 1000)
      : null;

    await this.prisma.telehealthSession.update({
      where: { id: sessionId },
      data:  { endedAt, durationSeconds: duration },
    });

    // Revoke both participants
    await this.videoProvider.revokeToken(session.providerRoomId, 'patient');
    await this.videoProvider.revokeToken(session.providerRoomId, 'physician');

    // Emit post-call event to HIS queue
    await this.his.publish({
      type:           'telehealth.session.ended' as never,
      idempotencyKey: sessionId,
      payload: {
        sessionId,
        clinicId:    session.clinicId,
        physicianId: session.physicianId,
        patientToken: session.patientToken,
        scheduledAt: session.scheduledAt.toISOString(),
        startedAt:   session.startedAt?.toISOString(),
        endedAt:     endedAt.toISOString(),
        durationSeconds: duration,
      },
      timestamp: endedAt.toISOString(),
    });

    await this.audit.log({
      actorEmail: actorId,
      actorRole:  'participant',
      action:     'telehealth.session.ended',
      resource:   'telehealth_session',
      resourceId: sessionId,
      detail:     { durationSeconds: duration },
      ip,
    });
  }

  async cancelSession(sessionId: string, actorId: string, reason: string, ip?: string, caller?: TelehealthCaller): Promise<void> {
    const session = await this.prisma.telehealthSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException(`Session ${sessionId} not found`);
    this.assertSessionAccess(session, caller);
    if (!reason?.trim()) throw new BadRequestException('A cancellation reason is required');

    await this.transitionStatus(sessionId, TelehealthStatus.cancelled, actorId);

    await this.audit.log({
      actorEmail: actorId,
      actorRole:  'participant',
      action:     'telehealth.session.cancelled',
      resource:   'telehealth_session',
      resourceId: sessionId,
      detail:     { reason },
      ip,
    });
  }

  async submitIntake(sessionId: string, dto: IntakeDto, ip?: string, caller?: TelehealthCaller): Promise<void> {
    const session = await this.prisma.telehealthSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException(`Session ${sessionId} not found`);
    this.assertSessionAccess(session, caller);

    await this.prisma.telehealthIntake.upsert({
      where:  { sessionId },
      create: {
        id:                 randomUUID(),
        sessionId,
        reason:             dto.reason,
        currentMedications: dto.currentMedications,
        symptoms:           dto.symptoms,
        vitalsNote:         dto.vitalsNote ?? null,
        submittedAt:        new Date(),
      },
      update: {
        reason:             dto.reason,
        currentMedications: dto.currentMedications,
        symptoms:           dto.symptoms,
        vitalsNote:         dto.vitalsNote ?? null,
        submittedAt:        new Date(),
      },
    });

    await this.prisma.telehealthSession.update({
      where: { id: sessionId },
      data:  { intakeSubmitted: true },
    });

    await this.audit.log({
      actorEmail: session.patientToken,
      actorRole:  'patient',
      action:     'telehealth.intake.submitted',
      resource:   'telehealth_session',
      resourceId: sessionId,
      ip,
    });
  }

  async saveSummary(sessionId: string, dto: SummaryDto, actorId: string, ip?: string): Promise<void> {
    const session = await this.prisma.telehealthSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException(`Session ${sessionId} not found`);

    await this.prisma.telehealthSummary.upsert({
      where:  { sessionId },
      create: {
        id:                        randomUUID(),
        sessionId,
        clinicalNote:              dto.clinicalNote,
        followUpRecommendationSk:  dto.followUpRecommendationSk ?? null,
        followUpRecommendationEn:  dto.followUpRecommendationEn ?? null,
        prescriptionIssued:        dto.prescriptionIssued ?? false,
        prescriptionRef:           dto.prescriptionRef ?? null,
      },
      update: {
        clinicalNote:              dto.clinicalNote,
        followUpRecommendationSk:  dto.followUpRecommendationSk ?? null,
        followUpRecommendationEn:  dto.followUpRecommendationEn ?? null,
        prescriptionIssued:        dto.prescriptionIssued ?? false,
        prescriptionRef:           dto.prescriptionRef ?? null,
      },
    });

    await this.audit.log({
      actorEmail: actorId,
      actorRole:  'physician',
      action:     'telehealth.summary.saved',
      resource:   'telehealth_session',
      resourceId: sessionId,
      ip,
    });
  }

  async getSummary(sessionId: string, actorId: string, ip?: string, caller?: TelehealthCaller) {
    const session = await this.prisma.telehealthSession.findUnique({
      where: { id: sessionId }, select: { physicianId: true },
    });
    if (!session) throw new NotFoundException(`Session ${sessionId} not found`);
    this.assertSessionAccess(session, caller);

    const summary = await this.prisma.telehealthSummary.findUnique({ where: { sessionId } });

    await this.audit.log({
      actorEmail: actorId,
      actorRole:  'participant',
      action:     'telehealth.summary.accessed',
      resource:   'telehealth_session',
      resourceId: sessionId,
      ip,
    });

    return summary;
  }

  async getSession(sessionId: string, caller?: TelehealthCaller) {
    const session = await this.prisma.telehealthSession.findUnique({
      where:   { id: sessionId },
      include: { intake: true, summary: true },
    });
    if (!session) throw new NotFoundException(`Session ${sessionId} not found`);
    this.assertSessionAccess(session, caller);
    return session;
  }

  async listSessions(physicianId?: string, patientToken?: string, statuses?: TelehealthStatus[]) {
    return this.prisma.telehealthSession.findMany({
      where: {
        ...(physicianId  ? { physicianId }  : {}),
        ...(patientToken ? { patientToken } : {}),
        ...(statuses?.length ? { status: { in: statuses } } : {}),
      },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  async transitionStatus(
    sessionId: string,
    newStatus: TelehealthStatus,
    actorId: string,
  ): Promise<void> {
    const session = await this.prisma.telehealthSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException(`Session ${sessionId} not found`);

    // Application-layer guard (DB trigger is the authoritative enforcement layer)
    if (!isTransitionAllowed(session.status, newStatus)) {
      throw new BadRequestException(
        `Illegal telehealth status transition: ${session.status} → ${newStatus}`,
      );
    }

    await this.prisma.telehealthSession.update({
      where: { id: sessionId },
      data:  { status: newStatus, updatedAt: new Date() },
    });

    await this.audit.log({
      actorEmail: actorId,
      actorRole:  'system',
      action:     `telehealth.status.${session.status}_to_${newStatus}`,
      resource:   'telehealth_session',
      resourceId: sessionId,
      detail:     { from: session.status, to: newStatus },
    });
  }
}
