import { ConflictException, ForbiddenException, UnprocessableEntityException } from '@nestjs/common';
import { BookingAdminService, type StaffActor } from '../booking-admin.service';
import { BookingRulesService } from '../booking-rules.service';

const FUTURE_DATE = '2099-12-31';
const PAST_DATE = '2000-01-01';

const ADMIN: StaffActor = { staffId: 'staff-1', email: 'admin@ns.sk', role: 'administrator', scopes: [] };
const SUPER: StaffActor = { staffId: 'staff-0', email: 'root@ns.sk', role: 'super_admin', scopes: [] };
const CLINICIAN = (scopes: string[]): StaffActor => ({ staffId: 'staff-2', email: 'doc@ns.sk', role: 'clinician', scopes });

function makeService(booking?: Record<string, unknown>) {
  const prisma = {
    booking: {
      findUnique: jest.fn().mockResolvedValue(booking ?? null),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      update: jest.fn().mockResolvedValue({}),
    },
    availabilitySlot: {
      findUnique: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    paymentReceipt: { findFirst: jest.fn().mockResolvedValue(null) },
    portalNotification: { create: jest.fn().mockResolvedValue({}) },
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  };

  const audit = { writeAuditEntry: jest.fn().mockResolvedValue(undefined) };
  const sms = {
    sendBookingCancellation: jest.fn().mockResolvedValue(undefined),
    sendBookingReschedule: jest.fn().mockResolvedValue(undefined),
  };
  const his = { publish: jest.fn().mockResolvedValue(undefined) };
  const cms = { getClinicById: jest.fn().mockResolvedValue({ id: 'urology', name: { sk: 'Urológia' } }) };
  const rules = new BookingRulesService();

  const svc = new BookingAdminService(prisma as never, rules, audit as never, sms as never, his as never, cms as never);
  return { svc, prisma, audit, sms };
}

const bookingRow = (over: Record<string, unknown> = {}) => ({
  id: 'bk-1',
  clinicId: 'urology',
  patientPhone: '+421900000000',
  patientRcHash: '$2a$12$abcdefghijklmnopqrstuv',
  date: FUTURE_DATE,
  time: '09:00',
  status: 'CONFIRMED',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  ...over,
});

describe('BookingAdminService.cancel', () => {
  it('D-1 cancels a valid future booking: status=cancelled, audit + SMS', async () => {
    const { svc, prisma, audit, sms } = makeService(bookingRow());
    const res = await svc.cancel(ADMIN, 'bk-1', { reason: 'patient request' });
    expect(res.status).toBe('cancelled');
    expect(prisma.booking.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'CANCELLED' } }));
    expect(sms.sendBookingCancellation).toHaveBeenCalled();
    expect(audit.writeAuditEntry).toHaveBeenCalledWith(expect.objectContaining({ action: 'booking_cancelled' }));
  });

  it('D-2 already-cancelled booking → 409 Conflict', async () => {
    const { svc } = makeService(bookingRow({ status: 'CANCELLED' }));
    await expect(svc.cancel(ADMIN, 'bk-1', { reason: 'x' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('D-3 clinician scoped to a different clinic → 403 Forbidden', async () => {
    const { svc } = makeService(bookingRow());
    await expect(svc.cancel(CLINICIAN(['clinic:cardiology']), 'bk-1', { reason: 'x' })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('D-4 past slot → 422 (cannot cancel a past appointment)', async () => {
    const { svc } = makeService(bookingRow({ date: PAST_DATE }));
    await expect(svc.cancel(ADMIN, 'bk-1', { reason: 'x' })).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('does not send SMS when notifyPatient=false', async () => {
    const { svc, sms } = makeService(bookingRow());
    await svc.cancel(ADMIN, 'bk-1', { reason: 'x', notifyPatient: false });
    expect(sms.sendBookingCancellation).not.toHaveBeenCalled();
  });
});

describe('BookingAdminService.reschedule', () => {
  it('D-5 same-clinic available slot → updated + notification queued', async () => {
    const { svc, prisma, audit } = makeService(bookingRow());
    prisma.availabilitySlot.findUnique.mockResolvedValue({ id: 'slot-2', clinicId: 'urology', date: FUTURE_DATE, time: '10:30', booked: false });
    const res = await svc.reschedule(ADMIN, 'bk-1', { newSlotId: 'slot-2' });
    expect(res.status).toBe('booked');
    expect(prisma.portalNotification.create).toHaveBeenCalled();
    expect(audit.writeAuditEntry).toHaveBeenCalledWith(expect.objectContaining({ action: 'booking_rescheduled' }));
  });

  it('D-6 new slot in a different clinic → 422', async () => {
    const { svc, prisma } = makeService(bookingRow());
    prisma.availabilitySlot.findUnique.mockResolvedValue({ id: 'slot-2', clinicId: 'cardiology', date: FUTURE_DATE, time: '10:30', booked: false });
    await expect(svc.reschedule(ADMIN, 'bk-1', { newSlotId: 'slot-2' })).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('D-7 clinician role → 403 (administrator+ only)', async () => {
    const { svc } = makeService(bookingRow());
    await expect(svc.reschedule(CLINICIAN(['clinic:urology']), 'bk-1', { newSlotId: 'slot-2' })).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('BookingAdminService.noShow', () => {
  it('D-8 past slot → status=no_show, audit written, no SMS/refund', async () => {
    const { svc, prisma, audit, sms } = makeService(bookingRow({ date: PAST_DATE }));
    const res = await svc.noShow(ADMIN, 'bk-1');
    expect(res.status).toBe('no_show');
    expect(prisma.booking.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'NO_SHOW' } }));
    expect(sms.sendBookingCancellation).not.toHaveBeenCalled();
    expect(audit.writeAuditEntry).toHaveBeenCalledWith(expect.objectContaining({ action: 'booking_no_show' }));
  });

  it('rejects a no-show for a future appointment → 422', async () => {
    const { svc } = makeService(bookingRow());
    await expect(svc.noShow(ADMIN, 'bk-1')).rejects.toBeInstanceOf(UnprocessableEntityException);
  });
});

describe('BookingAdminService.stats', () => {
  it('D-9 returns today/week/pending counts from the bookings table', async () => {
    const { svc, prisma } = makeService();
    // 8 count() calls in order: tBooked,tCancelled,tNoShow,tCompleted, wBooked,wCancelled,wNoShow, pending
    prisma.booking.count
      .mockResolvedValueOnce(14).mockResolvedValueOnce(2).mockResolvedValueOnce(1).mockResolvedValueOnce(9)
      .mockResolvedValueOnce(67).mockResolvedValueOnce(5).mockResolvedValueOnce(3)
      .mockResolvedValueOnce(4);
    const stats = await svc.stats(SUPER);
    expect(stats.today).toEqual({ booked: 14, cancelled: 2, noShow: 1, completed: 9 });
    expect(stats.week).toEqual({ booked: 67, cancelled: 5, noShow: 3 });
    expect(stats.pendingReview).toBe(4);
  });
});

describe('BookingAdminService.patientToken', () => {
  it('produces a deterministic opaque pseudonym (no identity)', () => {
    const t = BookingAdminService.patientToken('$2a$12$abcdefghijklmnopqrstuv');
    expect(t).toMatch(/^PT-[0-9A-F]{8}$/);
    expect(t).toBe(BookingAdminService.patientToken('$2a$12$abcdefghijklmnopqrstuv'));
  });
});
