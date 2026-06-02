/**
 * Booking edge-case tests — cases from COMPLETION_BRIEF A1 not covered by booking-api.e2e.test.ts:
 *
 *   8. Two concurrent requests for the same slot → exactly one succeeds (atomic lock),
 *      the other gets a 400. Assert only one booking row exists and the slot is locked.
 *   9. A slot in the past → 400 before slot logic runs.
 *  10. Tampered clinic/slot mismatch (slot belongs to a different clinic) → 400.
 *
 * Cases 8 and 10 require a real PostgreSQL instance (slot rows must exist).
 * Case 9 is pure-date validation and can run without a DB.
 *
 * Run in CI after `db:push` and `audit-immutability.sql` are applied:
 *   pnpm --filter=@ns/api test -- --testPathPattern="booking-edge-cases"
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import * as request from 'supertest';
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { BookingController } from '../booking/booking.controller';
import { BookingService } from '../booking/booking.service';
import { BookingRulesService } from '../booking/booking-rules.service';
import { PrismaService } from '../prisma/prisma.service';
import { HisQueueService } from '../his/his-queue.service';
import { SmsService } from '../sms/sms.service';
import { AuditService } from '../audit/audit.service';
import { CmsClinicService } from '../cms/cms-clinic.service';
import { CLINICS_SEED } from '../config/seed-clinics';

const VALID_RC = '9001014719';

// ── Next occurrence of a JS weekday ────────────────────────
function nextWeekday(target: 0 | 1 | 2 | 3 | 4 | 5 | 6): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 1);
  while (d.getDay() !== target) d.setDate(d.getDate() + 1);
  return d.toISOString().substring(0, 10);
}

function pastDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().substring(0, 10);
}

// ── Real Prisma (for slot-creation in cases 8 + 10) ────────
// These tests need DATABASE_URL pointing at a real test DB.
const NEEDS_DB = !!process.env['DATABASE_URL'] && process.env['DATABASE_URL'] !== 'skip';

const describeIfDb = NEEDS_DB ? describe : describe.skip;

// ── Shared app setup ────────────────────────────────────────
async function buildApp(prismaOverride?: Record<string, unknown>): Promise<INestApplication> {
  const mockHis   = { publish: jest.fn().mockResolvedValue(undefined) };
  const mockSms   = { sendBookingConfirmation: jest.fn().mockResolvedValue(undefined), sendBookingCancellation: jest.fn().mockResolvedValue(undefined) };
  const mockAudit = { log: jest.fn().mockResolvedValue(undefined) };
  const mockCms   = {
    getAllClinics:  jest.fn().mockResolvedValue(CLINICS_SEED),
    getClinicById: jest.fn().mockImplementation((id: string) =>
      Promise.resolve(CLINICS_SEED.find((c) => c.id === id)),
    ),
    invalidate: jest.fn(),
  };

  const module: TestingModule = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true }),
      ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    ],
    controllers: [BookingController],
    providers: [
      BookingService,
      BookingRulesService,
      { provide: PrismaService,    useValue: prismaOverride ?? { availabilitySlot: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) }, booking: {}, $transaction: jest.fn() } },
      { provide: HisQueueService,  useValue: mockHis },
      { provide: SmsService,       useValue: mockSms },
      { provide: AuditService,     useValue: mockAudit },
      { provide: CmsClinicService, useValue: mockCms },
    ],
  }).compile();

  const app = module.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  await app.init();
  return app;
}

// ══════════════════════════════════════════════════════════════
// CASE 9 — Past date: rejected before slot logic runs
// Uses mocked Prisma — no DB needed.
// ══════════════════════════════════════════════════════════════
describe('Case 9 — past-date booking rejected', () => {
  let app: INestApplication;

  beforeAll(async () => { app = await buildApp(); });
  afterAll(async () => { await app.close(); });

  it('rejects a booking with a date in the past', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/booking')
      .send({
        clinicId:        'chirurgicka',   // bookingDays [1-5], status:open
        date:            pastDate(),       // yesterday
        time:            '10:00',
        patientName:     'Test Pacient',
        patientPhone:    '+421900000000',
        patientRc:       VALID_RC,
        hasReferral:     false,
        gdprConsent:     true,
        referralConsent: false,
      });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/past|expired|invalid date|future/i);
  });

  it('accepts a booking with tomorrows date (valid)', async () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    // Find next Mon–Fri
    while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
    const tomorrowWeekday = d.toISOString().substring(0, 10);

    const res = await request(app.getHttpServer())
      .post('/api/booking')
      .send({
        clinicId:        'chirurgicka',
        date:            tomorrowWeekday,
        time:            '10:00',
        patientName:     'Test Pacient',
        patientPhone:    '+421900000000',
        patientRc:       VALID_RC,
        hasReferral:     false,
        gdprConsent:     true,
        referralConsent: false,
      });
    // Mocked Prisma → no slot available → 400 "slot not available"
    // NOT a rules/past-date error — rules passed
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/slot|available/i);
    expect(res.body.message).not.toMatch(/past|expired/i);
  });
});

// ══════════════════════════════════════════════════════════════
// CASE 8 — Concurrent requests: exactly one wins, other gets 400
// CASE 10 — Slot-clinic mismatch: slot belongs to another clinic
// Both require real DB rows.
// ══════════════════════════════════════════════════════════════
describeIfDb('Cases 8 + 10 — real DB (slot-level tests)', () => {
  const realPrisma = new PrismaClient({
    datasources: { db: { url: process.env['DATABASE_URL'] } },
  });

  const SLOT_DATE = nextWeekday(2); // next Tuesday (trauma surgery: bookingDays=[2,4])
  const SLOT_TIME = '09:00';
  const CLINIC_A  = 'urazova-chirurgia';
  const CLINIC_B  = 'chirurgicka';
  let slotId: string;
  let clinicBSlotId: string;

  // Inject real Prisma into the NestJS test app
  let app: INestApplication;

  beforeAll(async () => {
    await realPrisma.$connect();

    // Seed a slot for CLINIC_A
    slotId = randomUUID();
    await realPrisma.availabilitySlot.create({
      data: { id: slotId, clinicId: CLINIC_A, date: SLOT_DATE, time: SLOT_TIME, booked: false },
    });

    // Seed a slot for CLINIC_B (used in Case 10 mismatch test)
    clinicBSlotId = randomUUID();
    await realPrisma.availabilitySlot.create({
      data: { id: clinicBSlotId, clinicId: CLINIC_B, date: SLOT_DATE, time: SLOT_TIME, booked: false },
    });

    // Build app with REAL Prisma
    app = await buildApp(realPrisma as unknown as Record<string, unknown>);
  });

  afterAll(async () => {
    // Clean up test slots + any bookings created
    await realPrisma.booking.deleteMany({ where: { clinicId: { in: [CLINIC_A, CLINIC_B] }, date: SLOT_DATE } });
    await realPrisma.availabilitySlot.deleteMany({ where: { id: { in: [slotId, clinicBSlotId] } } });
    await realPrisma.$disconnect();
    await app.close();
  });

  // ── Case 8: concurrent requests ──────────────────────────

  it('Case 8: two concurrent requests for the same slot — exactly one succeeds', async () => {
    const body = {
      clinicId:        CLINIC_A,
      date:            SLOT_DATE,
      time:            SLOT_TIME,
      patientName:     'Concurrent Test',
      patientPhone:    '+421900000001',
      patientRc:       VALID_RC,
      hasReferral:     false,
      gdprConsent:     true,
      referralConsent: false,
    };

    // Fire two simultaneous requests
    const [res1, res2] = await Promise.all([
      request(app.getHttpServer()).post('/api/booking').send({ ...body, patientName: 'Patient A' }),
      request(app.getHttpServer()).post('/api/booking').send({ ...body, patientName: 'Patient B' }),
    ]);

    const statuses = [res1.status, res2.status].sort();

    // Exactly one 201/200 and one 400
    expect(statuses).toEqual([200, 400]);

    const winner = res1.status === 200 ? res1 : res2;
    expect(winner.body).toHaveProperty('id');

    // DB: slot is locked
    const slot = await realPrisma.availabilitySlot.findUnique({ where: { id: slotId } });
    expect(slot?.booked).toBe(true);

    // DB: exactly one booking exists
    const bookings = await realPrisma.booking.findMany({
      where: { clinicId: CLINIC_A, date: SLOT_DATE, time: SLOT_TIME },
    });
    expect(bookings).toHaveLength(1);
  });

  // ── Case 10: slot-clinic mismatch ────────────────────────

  it('Case 10: slot belonging to a different clinic is not returned for clinic A', async () => {
    // Clinic A request on SLOT_DATE/SLOT_TIME where the only available slot
    // belongs to CLINIC_B — the findFirst query filters by clinicId=CLINIC_A
    // so it returns null, giving 400 "slot not available"
    // (CLINIC_A slot was consumed by Case 8 above)
    const res = await request(app.getHttpServer())
      .post('/api/booking')
      .send({
        clinicId:        CLINIC_A,       // requests clinic A
        date:            SLOT_DATE,
        time:            SLOT_TIME,      // clinic B has a slot here, but not clinic A
        patientName:     'Mismatch Test',
        patientPhone:    '+421900000002',
        patientRc:       VALID_RC,
        hasReferral:     false,
        gdprConsent:     true,
        referralConsent: false,
      });

    // Slot query: WHERE clinicId='urazova-chirurgia' AND booked=false → null
    // Booking for clinic B's slot is impossible through this path
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/slot|available/i);

    // DB: clinic B's slot is untouched
    const slotB = await realPrisma.availabilitySlot.findUnique({ where: { id: clinicBSlotId } });
    expect(slotB?.booked).toBe(false);
  });
});
