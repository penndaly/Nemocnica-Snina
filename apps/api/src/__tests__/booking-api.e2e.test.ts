/**
 * End-to-end HTTP tests for POST /api/booking.
 *
 * These tests spin up the real NestJS application with:
 *   - BookingRulesService REAL (no mock — this is what we're validating)
 *   - PrismaService MOCKED (no real DB needed for rule-rejection tests, because
 *     the rules run in steps 1-4 and Prisma is only reached at step 5)
 *   - HisQueueService MOCKED (no-op)
 *   - SmsService MOCKED (no-op)
 *
 * Every test sends a forged HTTP request directly to the controller, bypassing
 * the wizard UI entirely. The rules MUST be enforced server-side.
 *
 * Covered:
 *   1. Wednesday slot → angiology (bookingDays=[4,5]) → 400
 *   2. Thursday slot, 09:00 → angiology (window 13:00–14:00) → 400
 *   3. Thursday slot, 13:20 → angiology (window 13:00–14:00), no referral consent → 400
 *   4. Any slot → diabetologicka (status:closed, bookable:false) → 400
 *   5. Any slot → neurologicka (status:alert, bookable:false) → 400
 *   6. Monday slot → hematologicka (bookingDays=[1,2,3,4], bookable:true), but
 *      Friday → 400 (closed Fridays)
 *   7. Invalid RC → 400 (regardless of clinic/date)
 *   8. Missing GDPR consent → 400 (regardless of everything else)
 *   9. Referral clinic (urologicka) without referralConsent → 400
 *  10. Valid Monday slot → trauma surgery (bookingDays=[2,4]) → 400 (Monday = weekday 1)
 *  11. Valid Tuesday slot → trauma surgery → reaches slot-lookup (400 "no slot available"),
 *      NOT the rules error — proves rules passed
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { BookingController } from '../booking/booking.controller';
import { BookingService } from '../booking/booking.service';
import { BookingRulesService } from '../booking/booking-rules.service';
import { PrismaService } from '../prisma/prisma.service';
import { HisQueueService } from '../his/his-queue.service';
import { SmsService } from '../sms/sms.service';
import { AuditService } from '../audit/audit.service';
import { CmsClinicService } from '../cms/cms-clinic.service';
import { CLINICS_SEED } from '../config/seed-clinics';

// A valid Slovak RC that passes modulo-11 (used in all tests that aren't testing RC validation)
const VALID_RC = '9001010007';

// Prisma mock — returns null for availabilitySlot.findFirst (no slots exist)
// This means: rules-rejected requests never reach this mock; slot-unavailable
// requests reach it and get 400 "slot not available" — different error message.
const mockPrisma = {
  availabilitySlot: {
    findFirst: jest.fn().mockResolvedValue(null),
    findMany: jest.fn().mockResolvedValue([]),
  },
  booking: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
  $transaction: jest.fn(),
};

const mockHis = { publish: jest.fn().mockResolvedValue(undefined) };
const mockSms = {
  sendBookingConfirmation: jest.fn().mockResolvedValue(undefined),
  sendBookingCancellation: jest.fn().mockResolvedValue(undefined),
  sendOtp: jest.fn().mockResolvedValue(undefined),
  verifyOtp: jest.fn().mockResolvedValue(true),
};
const mockAudit = { log: jest.fn().mockResolvedValue(undefined) };
const mockCms = {
  getAllClinics:  jest.fn().mockResolvedValue(CLINICS_SEED),
  getClinicById: jest.fn().mockImplementation((id: string) =>
    Promise.resolve(CLINICS_SEED.find((c) => c.id === id)),
  ),
  invalidate: jest.fn(),
};

// ── Next weekday helper ───────────────────────────────────────
// Returns "YYYY-MM-DD" for the next occurrence of JS getDay() = target
function nextWeekday(target: 0 | 1 | 2 | 3 | 4 | 5 | 6): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 1);
  while (d.getDay() !== target) d.setDate(d.getDate() + 1);
  return d.toISOString().substring(0, 10);
}

// ── Base valid body (all fields present and valid for trauma surgery Mon–Fri) ──
function base(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    clinicId:        'urazova-chirurgia', // bookingDays:[2,4]
    date:            nextWeekday(2),      // next Tuesday
    time:            '10:00',
    patientName:     'Test Pacient',
    patientPhone:    '+421900000000',
    patientRc:       VALID_RC,
    hasReferral:     false,
    gdprConsent:     true,
    referralConsent: false,
    ...overrides,
  };
}

describe('POST /api/booking — server-side rule enforcement', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
      ],
      controllers: [BookingController],
      providers: [
        BookingService,
        BookingRulesService,
        { provide: PrismaService,    useValue: mockPrisma },
        { provide: HisQueueService,  useValue: mockHis },
        { provide: SmsService,       useValue: mockSms },
        { provide: AuditService,     useValue: mockAudit },
        { provide: CmsClinicService, useValue: mockCms },
      ],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();
  });

  afterAll(async () => { await app.close(); });

  // ── Angiology ──────────────────────────────────────────────

  it('1. rejects Wednesday slot for angiology (bookingDays=[4,5])', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/booking')
      .send({
        clinicId:        'angiologicka',
        date:            nextWeekday(3),  // Wednesday = JS day 3
        time:            '13:20',
        patientName:     'Test Pacient',
        patientPhone:    '+421900000000',
        patientRc:       VALID_RC,
        hasReferral:     true,
        gdprConsent:     true,
        referralConsent: true,
      });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/weekday|bookingDays/i);
  });

  it('2. rejects Thursday angiology slot outside the 13:00–14:00 window (09:00)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/booking')
      .send({
        clinicId:        'angiologicka',
        date:            nextWeekday(4),  // Thursday
        time:            '09:00',
        patientName:     'Test Pacient',
        patientPhone:    '+421900000000',
        patientRc:       VALID_RC,
        hasReferral:     true,
        gdprConsent:     true,
        referralConsent: true,
      });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/window|13:00/i);
  });

  it('3. rejects Thursday 13:20 angiology when referralConsent missing', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/booking')
      .send({
        clinicId:        'angiologicka',
        date:            nextWeekday(4),
        time:            '13:20',
        patientName:     'Test Pacient',
        patientPhone:    '+421900000000',
        patientRc:       VALID_RC,
        hasReferral:     false,
        gdprConsent:     true,
        referralConsent: false, // <-- forged: skips UI referral gate
      });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/referral/i);
  });

  it('3b. Thursday 13:20 angiology with referral passes rules (reaches slot-not-found)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/booking')
      .send({
        clinicId:        'angiologicka',
        date:            nextWeekday(4),
        time:            '13:20',
        patientName:     'Test Pacient',
        patientPhone:    '+421900000000',
        patientRc:       VALID_RC,
        hasReferral:     true,
        gdprConsent:     true,
        referralConsent: true,
      });
    // Prisma mock returns null → "slot not available" — rules passed
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/slot|available/i);
  });

  // ── Closed / alert / non-bookable ─────────────────────────

  it('4. rejects any slot for diabetologicka (status:closed, bookable:false)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/booking')
      .send({
        clinicId:        'diabetologicka',
        date:            nextWeekday(1),  // Monday
        time:            '10:00',
        patientName:     'Test Pacient',
        patientPhone:    '+421900000000',
        patientRc:       VALID_RC,
        hasReferral:     false,
        gdprConsent:     true,
        referralConsent: false,
      });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/bookable|closed/i);
  });

  it('5. rejects any slot for neurologicka (status:alert, bookable:false)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/booking')
      .send({
        clinicId:        'neurologicka',
        date:            nextWeekday(1),
        time:            '10:00',
        patientName:     'Test Pacient',
        patientPhone:    '+421900000000',
        patientRc:       VALID_RC,
        hasReferral:     false,
        gdprConsent:     true,
        referralConsent: false,
      });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/bookable|alert/i);
  });

  it('6. rejects Friday slot for hematologicka (bookingDays=[1,2,3,4], Fri=5)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/booking')
      .send({
        clinicId:        'hematologicka',
        date:            nextWeekday(5),  // Friday
        time:            '10:00',
        patientName:     'Test Pacient',
        patientPhone:    '+421900000000',
        patientRc:       VALID_RC,
        hasReferral:     false,
        gdprConsent:     true,
        referralConsent: true,
      });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/weekday|bookingDays/i);
  });

  it('6b. Monday slot for hematologicka passes rules (reaches slot-not-found)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/booking')
      .send({
        clinicId:        'hematologicka',
        date:            nextWeekday(1),  // Monday
        time:            '10:00',
        patientName:     'Test Pacient',
        patientPhone:    '+421900000000',
        patientRc:       VALID_RC,
        hasReferral:     false,
        gdprConsent:     true,
        referralConsent: true,
      });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/slot|available/i);
  });

  // ── Validation gates (before rules even run) ───────────────

  it('7. rejects invalid RC regardless of clinic/date', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/booking')
      .send(base({ patientRc: '1234567890' })); // fails modulo-11
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/rodné číslo|birth number|rc/i);
  });

  it('7b. rejects RC that is not all-digits', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/booking')
      .send(base({ patientRc: 'ABCDEFGHIJ' }));
    expect(res.status).toBe(400);
  });

  it('8. rejects missing GDPR consent — forged body with gdprConsent:false', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/booking')
      .send(base({ gdprConsent: false }));
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/GDPR|consent/i);
  });

  it('8b. rejects gdprConsent omitted entirely (undefined → false after body parsing)', async () => {
    const body = base();
    delete (body as Record<string, unknown>)['gdprConsent'];
    const res = await request(app.getHttpServer())
      .post('/api/booking')
      .send(body);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/GDPR|consent/i);
  });

  it('9. rejects urologicka booking without referralConsent', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/booking')
      .send({
        clinicId:        'urologicka',
        date:            nextWeekday(1),
        time:            '09:00',
        patientName:     'Test Pacient',
        patientPhone:    '+421900000000',
        patientRc:       VALID_RC,
        hasReferral:     false,
        gdprConsent:     true,
        referralConsent: false, // <-- client forges — skips UI checkbox
      });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/referral/i);
  });

  // ── Trauma surgery weekday enforcement ────────────────────

  it('10. rejects Monday slot for trauma surgery (bookingDays=[2,4], Mon=1)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/booking')
      .send(base({ date: nextWeekday(1) })); // Monday
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/weekday|bookingDays/i);
  });

  it('11. Tuesday trauma surgery passes rules — reaches slot-not-found (not a rules error)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/booking')
      .send(base({ date: nextWeekday(2) })); // Tuesday = bookingDays includes 2
    // Rules passed; Prisma mock returns null → slot unavailable
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/slot|available/i);
    // Crucially: NOT a rules/weekday message
    expect(res.body.message).not.toMatch(/weekday|bookingDays/i);
  });

  // ── Unknown clinic ─────────────────────────────────────────

  it('12. rejects unknown clinicId (cannot be resolved to a Clinic record)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/booking')
      .send(base({ clinicId: 'hacked-clinic-does-not-exist' }));
    // Controller throws Error('Unknown clinic') → 500 or 400 depending on filter
    expect([400, 404, 500]).toContain(res.status);
  });
});
