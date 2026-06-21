import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { BookingRulesService } from './booking-rules.service';
import { HisQueueService } from '../his/his-queue.service';
import { SmsService } from '../sms/sms.service';
import { AuditService } from '../audit/audit.service';
import { validateRodneCislo } from '../common/rc-validation';
import type { Clinic } from '@ns/types';

export interface CreateBookingDto {
  clinicId: string;
  date: string;
  time: string;
  patientName: string;
  patientPhone: string;
  patientRc: string;
  hasReferral: boolean;
  gdprConsent: boolean;
  referralConsent: boolean;
  locale?: string;
  mode?: 'telehealth';
  telehealthConsent?: boolean;
  minorGuardianConsent?: boolean;
}

const RC_SALT_ROUNDS = 12;

@Injectable()
export class BookingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rules: BookingRulesService,
    private readonly his: HisQueueService,
    private readonly sms: SmsService,
    private readonly audit: AuditService,
  ) {}

  async createBooking(clinic: Clinic, dto: CreateBookingDto) {
    // 1. RC format + modulo-11 check
    if (!validateRodneCislo(dto.patientRc)) {
      throw new BadRequestException('Invalid rodné číslo');
    }

    // 2. GDPR consent mandatory (Art. 9 GDPR — health data)
    if (!dto.gdprConsent) {
      throw new BadRequestException('GDPR consent is required');
    }

    // 3. Referral gate
    if (clinic.referral && !dto.referralConsent) {
      throw new BadRequestException('Referral confirmation is required for this clinic');
    }

    // 4. Server-side business rules — bookingDays, bookingWindow, status, bookable
    //    This is the line that must fire even if the client forges the request body.
    this.rules.validate(clinic, { clinicId: dto.clinicId, date: dto.date, time: dto.time });

    // 5. Slot lock — atomic claim prevents double-booking under concurrent requests.
    //    A single UPDATE … WHERE booked = false RETURNING id is serializable at the
    //    row level without a separate SELECT; two concurrent requests for the same
    //    slot will race and only one will get a non-empty result set.
    const rcHash = await bcrypt.hash(dto.patientRc, RC_SALT_ROUNDS);
    const cancelToken = randomUUID();
    const bookingId = randomUUID();

    const result = await this.prisma.$transaction(async (tx) => {
      // Column names are quoted camelCase — Prisma writes them as-is (no @map on fields).
      const claimed = await tx.$queryRaw<Array<{ id: string }>>`
        UPDATE availability_slots
        SET    "booked" = true
        WHERE  "clinicId" = ${dto.clinicId}
          AND  "date"     = ${dto.date}
          AND  "time"     = ${dto.time}
          AND  "booked"   = false
        RETURNING id
      `;
      if (claimed.length === 0) {
        throw new BadRequestException('The requested slot is no longer available');
      }
      const slotId = claimed[0]!.id;

      const booking = await tx.booking.create({
        data: {
          id: bookingId,
          clinicId: dto.clinicId,
          patientName: dto.patientName,
          patientPhone: dto.patientPhone,
          patientRcHash: rcHash,
          date: dto.date,
          time: dto.time,
          hasReferral: dto.hasReferral,
          gdprConsent: dto.gdprConsent,
          referralConsent: dto.referralConsent,
          mode: dto.mode ?? null,
          status: BookingStatus.PENDING,
          cancelToken,
          slot: { connect: { id: slotId } },
        },
      });

      // Append-only consent records
      const consentRows = [
        { consentType: 'gdpr', granted: dto.gdprConsent },
        ...(dto.referralConsent ? [{ consentType: 'referral', granted: true }] : []),
        ...(dto.mode === 'telehealth' && dto.telehealthConsent
          ? [{ consentType: 'telehealth_medical_record', granted: true }]
          : []),
        ...(dto.mode === 'telehealth' && dto.minorGuardianConsent
          ? [{ consentType: 'minor_guardian', granted: true }]
          : []),
      ];
      await tx.bookingConsent.createMany({
        data: consentRows.map((c) => ({ ...c, bookingId: booking.id })),
      });

      return { id: booking.id, cancelToken };
    });

    // Post-transaction side effects (non-blocking; failures don't roll back the booking)
    void this.audit.log({
      actorEmail: dto.patientPhone, // no staff actor — patient is the subject
      actorRole: 'patient',
      action: 'booking_confirm',
      resource: 'booking',
      resourceId: result.id,
      detail: { clinicId: dto.clinicId, date: dto.date, time: dto.time },
    });
    void this.his.publish({
      type: dto.mode === 'telehealth' ? 'telehealth.booking.confirmed' : 'booking.confirmed',
      idempotencyKey: result.id,
      payload: {
        clinicId: dto.clinicId,
        patientName: dto.patientName,
        date: dto.date,
        time: dto.time,
        ...(dto.mode === 'telehealth' && { mode: 'telehealth' }),
      },
      timestamp: new Date().toISOString(),
    });
    void this.sms.sendBookingConfirmation({
      phone: dto.patientPhone,
      bookingId: result.id,
      clinicName: dto.clinicId,
      date: dto.date,
      time: dto.time,
      cancelToken: result.cancelToken,
      locale: dto.locale,
    });

    return result;
  }

  async cancelBooking(cancelToken: string) {
    const booking = await this.prisma.booking.findUnique({ where: { cancelToken } });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.status === BookingStatus.CANCELLED) {
      throw new BadRequestException('Booking is already cancelled');
    }

    await this.prisma.$transaction([
      this.prisma.booking.update({
        where: { id: booking.id },
        data: { status: BookingStatus.CANCELLED },
      }),
      this.prisma.availabilitySlot.updateMany({
        where: { bookingId: booking.id },
        data: { booked: false, bookingId: null },
      }),
    ]);

    void this.audit.log({
      actorEmail: booking.patientPhone,
      actorRole: 'patient',
      action: 'booking_cancel',
      resource: 'booking',
      resourceId: booking.id,
    });
    void this.his.publish({
      type: 'booking.cancelled',
      idempotencyKey: `cancel:${booking.id}`,
      payload: { bookingId: booking.id },
      timestamp: new Date().toISOString(),
    });
    void this.sms.sendBookingCancellation(booking.patientPhone, booking.id);

    return { cancelled: true };
  }

  async getAvailableSlots(clinicId: string, date: string) {
    return this.prisma.availabilitySlot.findMany({
      where: { clinicId, date, booked: false },
      select: { id: true, time: true },
      orderBy: { time: 'asc' },
    });
  }
}
