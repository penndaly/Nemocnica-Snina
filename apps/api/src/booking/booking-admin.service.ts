/**
 * Admin booking-management service (Sprint A4, Part B).
 *
 * Backs /api/admin/bookings. Booking rules stay server-side: cancel/reschedule/
 * no-show run the same BookingRulesService gates as the patient portal — this is
 * management, not a bypass. Every mutation writes an append-only audit entry.
 *
 * Patient identity is never exposed: the admin sees an opaque, deterministic
 * pseudonym (sha256 of the bcrypt RC hash, first 8 hex chars) — never the name,
 * phone, or RC. portal_notifications are keyed by that same pseudonym so a row
 * exists without storing identity.
 */
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus, Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SmsService } from '../sms/sms.service';
import { HisQueueService } from '../his/his-queue.service';
import { CmsClinicService } from '../cms/cms-clinic.service';
import { BookingRulesService } from './booking-rules.service';
import {
  BookingAdminItemDto,
  CancelBookingDto,
  DTO_TO_STATUS,
  ListBookingsQuery,
  PaymentDtoStatus,
  RescheduleBookingDto,
  STATUS_TO_DTO,
} from './booking-admin.dto';

/** Staff actor extracted from the verified JWT (never from the request body). */
export interface StaffActor {
  staffId: string;
  email: string;
  role: string;
  scopes: string[]; // "type:targetId"
}

const DEFAULT_DURATION_MIN = 30;
/** Refund grace: a paid slot cancelled with more than this lead time is refundable. */
const REFUND_WINDOW_HOURS = 24;

@Injectable()
export class BookingAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rules: BookingRulesService,
    private readonly audit: AuditService,
    private readonly sms: SmsService,
    private readonly his: HisQueueService,
    private readonly cms: CmsClinicService,
  ) {}

  // ── Scope helpers ───────────────────────────────────────────────────────────

  /** Clinic IDs a clinician is scoped to, or null for unrestricted (admin+). */
  private allowedClinicIds(actor: StaffActor): string[] | null {
    if (actor.role === 'super_admin' || actor.role === 'administrator') return null;
    return actor.scopes
      .filter((s) => s.startsWith('clinic:'))
      .map((s) => s.slice('clinic:'.length));
  }

  private assertClinicScope(actor: StaffActor, clinicId: string): void {
    const allowed = this.allowedClinicIds(actor);
    if (allowed !== null && !allowed.includes(clinicId)) {
      throw new ForbiddenException('SCOPE_DENIED');
    }
  }

  /** Deterministic, non-reversible patient pseudonym for admin display + notifications. */
  static patientToken(patientRcHash: string): string {
    return 'PT-' + createHash('sha256').update(patientRcHash).digest('hex').slice(0, 8).toUpperCase();
  }

  // ── Read ────────────────────────────────────────────────────────────────────

  async list(actor: StaffActor, q: ListBookingsQuery): Promise<{
    items: BookingAdminItemDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = Math.max(1, q.page ?? 1);
    const limit = Math.min(200, Math.max(1, q.limit ?? 50));

    const where: Prisma.BookingWhereInput = {};
    if (q.status) where.status = DTO_TO_STATUS[q.status];
    if (q.date) where.date = q.date;

    // Clinic filter intersected with the clinician's scope. An empty allowed set
    // (clinician with no clinic scopes) yields no rows — fail closed, never open.
    const allowed = this.allowedClinicIds(actor);
    const clinicFilter = this.intersectClinic(allowed, q.clinicId);
    if (clinicFilter.empty) return { items: [], total: 0, page, limit };
    if (clinicFilter.ids) where.clinicId = { in: clinicFilter.ids };
    else if (clinicFilter.single) where.clinicId = clinicFilter.single;

    const [rows, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        orderBy: [{ date: 'asc' }, { time: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.booking.count({ where }),
    ]);

    const items = await Promise.all(rows.map((b) => this.toDto(b)));
    return { items, total, page, limit };
  }

  /** Resolve the effective clinic filter from scope ∩ query. */
  private intersectClinic(
    allowed: string[] | null,
    queryClinicId?: string,
  ): { empty?: boolean; ids?: string[]; single?: string } {
    if (allowed === null) {
      return queryClinicId ? { single: queryClinicId } : {};
    }
    if (allowed.length === 0) return { empty: true };
    if (queryClinicId) {
      return allowed.includes(queryClinicId) ? { single: queryClinicId } : { empty: true };
    }
    return { ids: allowed };
  }

  async stats(actor: StaffActor): Promise<{
    today: { booked: number; cancelled: number; noShow: number; completed: number };
    week: { booked: number; cancelled: number; noShow: number };
    pendingReview: number;
  }> {
    const today = this.isoDate(new Date());
    const weekEnd = this.isoDate(this.addDays(new Date(), 7));

    const allowed = this.allowedClinicIds(actor);
    const scopeWhere: Prisma.BookingWhereInput =
      allowed === null ? {} : allowed.length === 0 ? { clinicId: { in: [] } } : { clinicId: { in: allowed } };

    const count = (extra: Prisma.BookingWhereInput) =>
      this.prisma.booking.count({ where: { ...scopeWhere, ...extra } });

    const [
      tBooked, tCancelled, tNoShow, tCompleted,
      wBooked, wCancelled, wNoShow,
      pendingReview,
    ] = await Promise.all([
      count({ date: today, status: BookingStatus.CONFIRMED }),
      count({ date: today, status: BookingStatus.CANCELLED }),
      count({ date: today, status: BookingStatus.NO_SHOW }),
      count({ date: today, status: BookingStatus.COMPLETED }),
      count({ date: { gte: today, lte: weekEnd }, status: BookingStatus.CONFIRMED }),
      count({ date: { gte: today, lte: weekEnd }, status: BookingStatus.CANCELLED }),
      count({ date: { gte: today, lte: weekEnd }, status: BookingStatus.NO_SHOW }),
      count({ date: { gte: today }, status: BookingStatus.PENDING }),
    ]);

    return {
      today: { booked: tBooked, cancelled: tCancelled, noShow: tNoShow, completed: tCompleted },
      week: { booked: wBooked, cancelled: wCancelled, noShow: wNoShow },
      pendingReview,
    };
  }

  // ── Mutations ─────────────────────────────────────────────────────────────────

  async cancel(actor: StaffActor, id: string, dto: CancelBookingDto, ip?: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id } });
    if (!booking) throw new NotFoundException('BOOKING_NOT_FOUND');
    this.assertClinicScope(actor, booking.clinicId);

    if (booking.status === BookingStatus.CANCELLED || booking.status === BookingStatus.COMPLETED) {
      throw new ConflictException('BOOKING_ALREADY_CLOSED');
    }
    // Server-side rule: the same gate the portal uses. Past slot → 422.
    this.rules.validateCancellation(booking);

    const notifyPatient = dto.notifyPatient ?? true;
    const slotIso = this.rules.slotDate(booking.date, booking.time).toISOString();
    const refundQueued = await this.computeRefund(booking.id, booking.date, booking.time);

    await this.prisma.$transaction([
      this.prisma.booking.update({ where: { id }, data: { status: BookingStatus.CANCELLED } }),
      this.prisma.availabilitySlot.updateMany({
        where: { bookingId: id },
        data: { booked: false, bookingId: null },
      }),
    ]);

    if (notifyPatient) {
      void this.sms.sendBookingCancellation(booking.patientPhone, booking.id);
      await this.notify(booking.patientRcHash, 'booking_cancelled', booking.clinicId, {
        message: `Objednanie ${slotIso} bolo zrušené.`,
      });
    }
    void this.his.publish({
      type: 'booking.cancelled',
      idempotencyKey: `admin-cancel:${booking.id}`,
      payload: { bookingId: booking.id, reason: dto.reason },
      timestamp: new Date().toISOString(),
    });

    await this.audit.writeAuditEntry({
      actorId: actor.staffId,
      actorName: actor.email,
      actorRole: actor.role,
      action: 'booking_cancelled',
      targetType: 'booking',
      targetId: booking.id,
      meta: { bookingId: booking.id, clinicId: booking.clinicId, slotIso, reason: dto.reason, notifyPatient, refundQueued },
      ipAddress: ip,
    });

    return { id: booking.id, status: 'cancelled' as const, refundQueued };
  }

  async reschedule(actor: StaffActor, id: string, dto: RescheduleBookingDto, ip?: string) {
    // Administrator+ only — cross-slot moves exceed a clinician's scope. Defence in
    // depth: the controller's @StaffRoles already gates this, re-checked here.
    if (actor.role !== 'administrator' && actor.role !== 'super_admin') {
      throw new ForbiddenException('RESCHEDULE_ADMIN_ONLY');
    }
    const booking = await this.prisma.booking.findUnique({ where: { id } });
    if (!booking) throw new NotFoundException('BOOKING_NOT_FOUND');

    if (booking.status === BookingStatus.CANCELLED || booking.status === BookingStatus.COMPLETED) {
      throw new ConflictException('BOOKING_ALREADY_CLOSED');
    }

    const newSlot = await this.prisma.availabilitySlot.findUnique({ where: { id: dto.newSlotId } });
    // Same-clinic + free + future gate (422 on any violation).
    this.rules.validateSlotAvailability(newSlot, booking.clinicId);

    const oldSlot = `${booking.date}T${booking.time}`;
    const newSlotIso = `${newSlot!.date}T${newSlot!.time}`;

    await this.prisma.$transaction([
      // Release the old slot.
      this.prisma.availabilitySlot.updateMany({
        where: { bookingId: id },
        data: { booked: false, bookingId: null },
      }),
      // Claim the new slot.
      this.prisma.availabilitySlot.update({
        where: { id: dto.newSlotId },
        data: { booked: true, bookingId: id },
      }),
      // Move the booking; status stays CONFIRMED/PENDING.
      this.prisma.booking.update({
        where: { id },
        data: { date: newSlot!.date, time: newSlot!.time },
      }),
    ]);

    void this.sms.sendBookingReschedule(booking.patientPhone, booking.id, newSlot!.date, newSlot!.time);
    await this.notify(booking.patientRcHash, 'booking_rescheduled', booking.clinicId, {
      message: `Objednanie bolo preobjednané na ${newSlotIso}.`,
    });

    await this.audit.writeAuditEntry({
      actorId: actor.staffId,
      actorName: actor.email,
      actorRole: actor.role,
      action: 'booking_rescheduled',
      targetType: 'booking',
      targetId: booking.id,
      meta: { bookingId: booking.id, oldSlot, newSlot: newSlotIso, reason: dto.reason ?? null },
      ipAddress: ip,
    });

    return { id: booking.id, status: 'booked' as const, slot: newSlotIso };
  }

  async noShow(actor: StaffActor, id: string, ip?: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id } });
    if (!booking) throw new NotFoundException('BOOKING_NOT_FOUND');
    this.assertClinicScope(actor, booking.clinicId);

    if (booking.status === BookingStatus.CANCELLED || booking.status === BookingStatus.COMPLETED) {
      throw new ConflictException('BOOKING_ALREADY_CLOSED');
    }
    // Past or within 30 min of start (422 otherwise). No refund on a no-show.
    this.rules.validateNoShow(booking);

    const slotIso = this.rules.slotDate(booking.date, booking.time).toISOString();
    await this.prisma.booking.update({ where: { id }, data: { status: BookingStatus.NO_SHOW } });

    await this.notify(booking.patientRcHash, 'no_show_recorded', booking.clinicId, {
      message: `Záznam o nedostavení sa pre ${slotIso}.`,
    });

    await this.audit.writeAuditEntry({
      actorId: actor.staffId,
      actorName: actor.email,
      actorRole: actor.role,
      action: 'booking_no_show',
      targetType: 'booking',
      targetId: booking.id,
      meta: { bookingId: booking.id, clinicId: booking.clinicId, slotIso },
      ipAddress: ip,
    });

    return { id: booking.id, status: 'no_show' as const };
  }

  // ── Internals ─────────────────────────────────────────────────────────────────

  private async toDto(b: {
    id: string; clinicId: string; patientRcHash: string; date: string; time: string;
    status: BookingStatus; createdAt: Date; updatedAt: Date;
  }): Promise<BookingAdminItemDto> {
    const clinic = await this.cms.getClinicById(b.clinicId).catch(() => undefined);
    const paymentStatus = await this.paymentStatusFor(b.id);
    return {
      id: b.id,
      patientTokenPreview: BookingAdminService.patientToken(b.patientRcHash),
      clinicId: b.clinicId,
      clinicName: clinic ? this.clinicName(clinic) : b.clinicId,
      slot: this.rules.slotDate(b.date, b.time).toISOString(),
      durationMin: DEFAULT_DURATION_MIN,
      status: STATUS_TO_DTO[b.status],
      paymentStatus,
      bookedAt: b.createdAt.toISOString(),
      updatedAt: b.updatedAt.toISOString(),
    };
  }

  private clinicName(clinic: { name?: unknown; id: string }): string {
    const n = clinic.name as { sk?: string; en?: string } | string | undefined;
    if (typeof n === 'string') return n;
    return n?.sk ?? n?.en ?? clinic.id;
  }

  /** paid when a receipt exists for the booking, else free. (No refund ledger today.) */
  private async paymentStatusFor(bookingId: string): Promise<PaymentDtoStatus> {
    const receipt = await this.prisma.paymentReceipt.findFirst({ where: { bookingId } });
    return receipt ? 'paid' : 'free';
  }

  private async computeRefund(bookingId: string, date: string, time: string): Promise<boolean> {
    const paid = (await this.paymentStatusFor(bookingId)) === 'paid';
    if (!paid) return false;
    const leadMs = this.rules.slotDate(date, time).getTime() - Date.now();
    return leadMs > REFUND_WINDOW_HOURS * 60 * 60 * 1000;
  }

  /** Write a portal_notification keyed by the opaque patient pseudonym. */
  private async notify(
    patientRcHash: string,
    type: string,
    clinicId: string,
    extra: { message?: string },
  ): Promise<void> {
    await this.prisma.portalNotification.create({
      data: {
        patientToken: BookingAdminService.patientToken(patientRcHash),
        type,
        severity: 'info',
        message: extra.message ?? null,
        flag: clinicId,
      },
    });
  }

  private isoDate(d: Date): string {
    return d.toISOString().slice(0, 10);
  }
  private addDays(d: Date, n: number): Date {
    const c = new Date(d);
    c.setDate(c.getDate() + n);
    return c;
  }
}
