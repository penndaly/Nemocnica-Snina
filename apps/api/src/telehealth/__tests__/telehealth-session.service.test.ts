import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { TelehealthStatus } from '@prisma/client';
import { TelehealthSessionService, E2E_TEST_PHYSICIAN_ID } from '../telehealth-session.service';
import { MockVideoProvider } from '../mock-video.provider';

// ── Minimal stubs ─────────────────────────────────────────────────────────────

type PartialSession = {
  id: string;
  bookingId: string;
  clinicId: string;
  physicianId: string;
  patientToken: string;
  scheduledAt: Date;
  status: TelehealthStatus;
  startedAt: Date | null;
  endedAt: Date | null;
  durationSeconds: number | null;
  videoProvider: string;
  providerRoomId: string;
  patientJoinToken: string | null;
  physicianJoinToken: string | null;
  tokensIssuedAt: Date | null;
  intakeSubmitted: boolean;
  hisSynced: boolean;
  createdAt: Date;
  updatedAt: Date;
};

function makeSession(overrides: Partial<PartialSession> = {}): PartialSession {
  return {
    id:                'sess-1',
    bookingId:         'book-1',
    clinicId:          'fro',
    physicianId:       'doc-1',
    patientToken:      'tok-abc',
    scheduledAt:       new Date(), // within the join window (WL-QA join-window guard)
    status:            TelehealthStatus.scheduled,
    startedAt:         null,
    endedAt:           null,
    durationSeconds:   null,
    videoProvider:     'mock',
    providerRoomId:    'ns-th-sess-1',
    patientJoinToken:  null,
    physicianJoinToken: null,
    tokensIssuedAt:    null,
    intakeSubmitted:   false,
    hisSynced:         false,
    createdAt:         new Date(),
    updatedAt:         new Date(),
    ...overrides,
  };
}

function buildPrismaMock(session = makeSession()) {
  return {
    telehealthSession: {
      create:   jest.fn().mockResolvedValue(session),
      findUnique: jest.fn().mockResolvedValue(session),
      update:   jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...session, ...data })),
      findMany: jest.fn().mockResolvedValue([session]),
    },
    telehealthIntake: {
      upsert: jest.fn().mockResolvedValue({}),
    },
    telehealthSummary: {
      upsert:    jest.fn().mockResolvedValue({}),
      findUnique: jest.fn().mockResolvedValue(null),
    },
    booking: {
      create: jest.fn().mockResolvedValue({}),
    },
    // Consent gate (S7) + completes the mock so patient-join tests reach the flow.
    bookingConsent: {
      findFirst: jest.fn().mockResolvedValue({ id: 'c1', granted: true }),
      create:    jest.fn().mockResolvedValue({}),
    },
  };
}

function buildAuditMock() {
  return { log: jest.fn().mockResolvedValue(undefined) };
}

function buildHisMock() {
  return { publish: jest.fn().mockResolvedValue(undefined) };
}

function buildCfgMock(overrides: Record<string, unknown> = {}) {
  const defaults: Record<string, unknown> = {
    LIVEKIT_URL:                      'wss://livekit.example.eu',
    TELEHEALTH_SESSION_TTL_SECONDS:   3600,
    TELEHEALTH_JOIN_WINDOW_SECONDS:   600,
    TELEHEALTH_PROVIDER:              'mock',
  };
  return {
    get:         (key: string) => overrides[key] ?? defaults[key],
    getOrThrow:  (key: string) => {
      const v = overrides[key] ?? defaults[key];
      if (v === undefined) throw new Error(`Missing config: ${key}`);
      return v;
    },
  };
}

function buildService(prisma = buildPrismaMock(), videoProvider = new MockVideoProvider()) {
  return new TelehealthSessionService(
    prisma as never,
    buildAuditMock() as never,
    buildHisMock() as never,
    buildCfgMock() as never,
    videoProvider,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('TelehealthSessionService', () => {
  describe('createSession', () => {
    it('creates a session row and a LiveKit room (idempotent)', async () => {
      const prisma  = buildPrismaMock();
      const video   = new MockVideoProvider();
      const service = buildService(prisma, video);

      const id = await service.createSession({
        bookingId:   'book-1',
        clinicId:    'fro',
        physicianId: 'doc-1',
        scheduledAt: new Date(),
      });

      expect(typeof id).toBe('string');
      expect(prisma.telehealthSession.create).toHaveBeenCalledTimes(1);

      // Idempotent room creation — second call should not throw
      const id2 = await service.createSession({
        bookingId:   'book-2',
        clinicId:    'fro',
        physicianId: 'doc-1',
        scheduledAt: new Date(),
      });
      expect(prisma.telehealthSession.create).toHaveBeenCalledTimes(2);
      expect(id).not.toBe(id2);
    });
  });

  describe('joinSession', () => {
    it('issues a token and returns wsUrl', async () => {
      const session = makeSession({ status: TelehealthStatus.scheduled });
      const prisma  = buildPrismaMock(session);
      const service = buildService(prisma);

      const result = await service.joinSession('sess-1', 'patient@test.sk', 'patient');
      expect(result.token).toMatch(/^mock\./);
      expect(result.wsUrl).toBe('wss://livekit.example.eu');
    });

    it('transitions scheduled → waiting on patient join', async () => {
      const session = makeSession({ status: TelehealthStatus.scheduled });
      const prisma  = buildPrismaMock(session);
      const service = buildService(prisma);

      await service.joinSession('sess-1', 'patient@test.sk', 'patient');

      // transitionStatus calls findUnique + update twice (one for guard, one for join update)
      expect(prisma.telehealthSession.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: TelehealthStatus.waiting }) }),
      );
    });

    it('throws ForbiddenException for cancelled sessions', async () => {
      const session = makeSession({ status: TelehealthStatus.cancelled });
      const prisma  = buildPrismaMock(session);
      const service = buildService(prisma);

      await expect(service.joinSession('sess-1', 'p', 'patient')).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException for ended sessions', async () => {
      const session = makeSession({ status: TelehealthStatus.ended });
      const prisma  = buildPrismaMock(session);
      const service = buildService(prisma);

      await expect(service.joinSession('sess-1', 'p', 'patient')).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException for unknown session', async () => {
      const prisma = buildPrismaMock();
      prisma.telehealthSession.findUnique.mockResolvedValue(null);
      const service = buildService(prisma);

      await expect(service.joinSession('unknown', 'p', 'patient')).rejects.toThrow(NotFoundException);
    });
  });

  describe('status transition enforcement', () => {
    const illegalTransitions: Array<[TelehealthStatus, TelehealthStatus]> = [
      [TelehealthStatus.ended,     TelehealthStatus.active],
      [TelehealthStatus.ended,     TelehealthStatus.waiting],
      [TelehealthStatus.no_show,   TelehealthStatus.active],
      [TelehealthStatus.cancelled, TelehealthStatus.active],
      [TelehealthStatus.waiting,   TelehealthStatus.scheduled],
      [TelehealthStatus.active,    TelehealthStatus.waiting],
    ];

    it.each(illegalTransitions)(
      'rejects illegal transition %s → %s',
      async (from, to) => {
        const session = makeSession({ status: from });
        const prisma  = buildPrismaMock(session);
        // findUnique for guard returns the same status each time
        prisma.telehealthSession.findUnique.mockResolvedValue(session);
        const service = buildService(prisma);

        await expect(service.transitionStatus('sess-1', to, 'actor')).rejects.toThrow(BadRequestException);
      },
    );

    const legalTransitions: Array<[TelehealthStatus, TelehealthStatus]> = [
      [TelehealthStatus.scheduled, TelehealthStatus.waiting],
      [TelehealthStatus.scheduled, TelehealthStatus.no_show],
      [TelehealthStatus.waiting,   TelehealthStatus.active],
      [TelehealthStatus.active,    TelehealthStatus.ended],
      [TelehealthStatus.scheduled, TelehealthStatus.cancelled],
      [TelehealthStatus.waiting,   TelehealthStatus.cancelled],
      [TelehealthStatus.active,    TelehealthStatus.cancelled],
    ];

    it.each(legalTransitions)(
      'allows legal transition %s → %s',
      async (from, to) => {
        const session = makeSession({ status: from });
        const prisma  = buildPrismaMock(session);
        prisma.telehealthSession.findUnique.mockResolvedValue(session);
        const service = buildService(prisma);

        await expect(service.transitionStatus('sess-1', to, 'actor')).resolves.toBeUndefined();
        expect(prisma.telehealthSession.update).toHaveBeenCalledWith(
          expect.objectContaining({ data: expect.objectContaining({ status: to }) }),
        );
      },
    );
  });

  describe('admitPatient', () => {
    it('transitions waiting → active and sets startedAt', async () => {
      const session = makeSession({ status: TelehealthStatus.waiting, physicianId: 'doc-1' });
      const prisma  = buildPrismaMock(session);
      prisma.telehealthSession.findUnique.mockResolvedValue(session);
      const service = buildService(prisma);

      await service.admitPatient('sess-1', 'doc-1');
      expect(prisma.telehealthSession.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ startedAt: expect.any(Date) }) }),
      );
    });

    it('throws ForbiddenException if wrong physician', async () => {
      const session = makeSession({ status: TelehealthStatus.waiting, physicianId: 'doc-1' });
      const prisma  = buildPrismaMock(session);
      prisma.telehealthSession.findUnique.mockResolvedValue(session);
      const service = buildService(prisma);

      await expect(service.admitPatient('sess-1', 'doc-2')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('endSession', () => {
    it('transitions active → ended, sets endedAt, emits HIS event', async () => {
      const session = makeSession({
        status:    TelehealthStatus.active,
        startedAt: new Date(Date.now() - 30_000),
      });
      const prisma  = buildPrismaMock(session);
      const his     = buildHisMock();
      prisma.telehealthSession.findUnique.mockResolvedValue(session);

      const service = new TelehealthSessionService(
        prisma as never,
        buildAuditMock() as never,
        his as never,
        buildCfgMock() as never,
        new MockVideoProvider(),
      );

      await service.endSession('sess-1', 'doc-1');

      expect(prisma.telehealthSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ endedAt: expect.any(Date) }),
        }),
      );
      expect(his.publish).toHaveBeenCalledWith(
        expect.objectContaining({ idempotencyKey: 'sess-1' }),
      );
    });
  });

  describe('cancelSession', () => {
    it('requires a non-empty reason', async () => {
      const session = makeSession({ status: TelehealthStatus.scheduled });
      const prisma  = buildPrismaMock(session);
      const service = buildService(prisma);

      await expect(service.cancelSession('sess-1', 'actor', '')).rejects.toThrow(BadRequestException);
    });
  });

  describe('submitIntake', () => {
    it('upserts intake and marks intakeSubmitted', async () => {
      const session = makeSession({ status: TelehealthStatus.waiting });
      const prisma  = buildPrismaMock(session);
      const service = buildService(prisma);

      await service.submitIntake('sess-1', {
        reason: 'Headache',
        currentMedications: 'None',
        symptoms: 'Pain',
      });

      expect(prisma.telehealthIntake.upsert).toHaveBeenCalledTimes(1);
      expect(prisma.telehealthSession.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { intakeSubmitted: true } }),
      );
    });
  });

  describe('seedTestSession (E2E fixture)', () => {
    it('creates a Booking + BookingConsent + TelehealthSession fixed to E2E_TEST_PHYSICIAN_ID', async () => {
      const prisma  = buildPrismaMock();
      const service = buildService(prisma);

      const result = await service.seedTestSession('fro', TelehealthStatus.waiting, true);

      expect(result.sessionId).toEqual(expect.any(String));
      expect(result.bookingId).toEqual(expect.any(String));
      expect(result.patientToken).toEqual(expect.any(String));

      expect(prisma.booking.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ mode: 'telehealth', clinicId: 'fro' }),
        }),
      );
      expect(prisma.bookingConsent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ consentType: 'telehealth_medical_record', granted: true }),
        }),
      );
      expect(prisma.telehealthSession.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            physicianId: E2E_TEST_PHYSICIAN_ID,
            status:      TelehealthStatus.waiting,
          }),
        }),
      );
    });

    it('sets startedAt/endedAt consistent with the requested status', async () => {
      const prisma  = buildPrismaMock();
      const service = buildService(prisma);

      await service.seedTestSession('fro', TelehealthStatus.ended, false);

      expect(prisma.telehealthSession.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            startedAt: expect.any(Date),
            endedAt:   expect.any(Date),
          }),
        }),
      );
      expect(prisma.bookingConsent.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ granted: false }) }),
      );
    });

    it('leaves startedAt/endedAt null for a freshly scheduled session', async () => {
      const prisma  = buildPrismaMock();
      const service = buildService(prisma);

      await service.seedTestSession('fro', TelehealthStatus.scheduled, true);

      expect(prisma.telehealthSession.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ startedAt: null, endedAt: null }),
        }),
      );
    });
  });
});
