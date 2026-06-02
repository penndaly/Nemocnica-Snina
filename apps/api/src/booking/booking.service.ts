import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { BookingRulesService } from './booking-rules.service';
import { HisQueueService } from '../his/his-queue.service';
import { SmsService } from '../sms/sms.service';
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
}

const RC_SALT_ROUNDS = 12;

@Injectable()
export class BookingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rules: BookingRulesService,
    private readonly his: HisQueueService,
    private readonly sms: SmsService,
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

    // 5. Slot lock (prevent double-booking)
    const slot = await this.prisma.availabilitySlot.findFirst({
      where: { clinicId: dto.clinicId, date: dto.date, time: dto.time, booked: false },
    });
    if (!slot) {
      throw new BadRequestException('The requested slot is no longer available');
    }

    // 6. Hash RC — plaintext never persisted
    const rcHash = await bcrypt.hash(dto.patientRc, RC_SALT_ROUNDS);
    const cancelToken = randomUUID();

    // 7. Atomic: mark slot booked + persist booking
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.availabilitySlot.update({
        where: { id: slot.id },
        data: { booked: true },
      });
      const booking = await tx.booking.create({
        data: {
          id: randomUUID(),
          clinicId: dto.clinicId,
          patientName: dto.patientName,
          patientPhone: dto.patientPhone,
          patientRcHash: rcHash,
          date: dto.date,
          time: dto.time,
          hasReferral: dto.hasReferral,
          gdprConsent: dto.gdprConsent,
          referralConsent: dto.referralConsent,
          status: BookingStatus.PENDING,
          cancelToken,
          slot: { connect: { id: slot.id } },
        },
      });
      return { id: booking.id, cancelToken };
    });

    // Post-transaction side effects (non-blocking; failures don't roll back the booking)
    void this.his.publish({
      type: 'booking.confirmed',
      idempotencyKey: result.id,
      payload: { clinicId: dto.clinicId, patientName: dto.patientName, date: dto.date, time: dto.time },
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
