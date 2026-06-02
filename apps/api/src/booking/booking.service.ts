import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient, BookingStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { BookingRulesService } from './booking-rules.service';
import { validateRodneCislo } from '../common/rc-validation';
import type { Clinic } from '@ns/types';

interface CreateBookingDto {
  clinicId: string;
  date: string;
  time: string;
  patientName: string;
  patientPhone: string;
  patientRc: string;
  hasReferral: boolean;
  gdprConsent: boolean;
  referralConsent: boolean;
}

const prisma = new PrismaClient();
const RC_SALT_ROUNDS = 12;

@Injectable()
export class BookingService {
  constructor(private readonly rules: BookingRulesService) {}

  async createBooking(clinic: Clinic, dto: CreateBookingDto) {
    // 1. Validate RC
    if (!validateRodneCislo(dto.patientRc)) {
      throw new BadRequestException('Invalid rodné číslo');
    }

    // 2. GDPR consent is mandatory (Art. 9 GDPR)
    if (!dto.gdprConsent) {
      throw new BadRequestException('GDPR consent is required');
    }

    // 3. Referral consent required when clinic.referral=true
    if (clinic.referral && !dto.referralConsent) {
      throw new BadRequestException('Referral confirmation is required for this clinic');
    }

    // 4. Server-side booking rule enforcement
    this.rules.validate(clinic, { clinicId: dto.clinicId, date: dto.date, time: dto.time });

    // 5. Check slot availability (lock to prevent double-booking)
    const slot = await prisma.availabilitySlot.findFirst({
      where: { clinicId: dto.clinicId, date: dto.date, time: dto.time, booked: false },
    });
    if (!slot) {
      throw new BadRequestException('The requested slot is no longer available');
    }

    // 6. Hash RC — never store plaintext
    const rcHash = await bcrypt.hash(dto.patientRc, RC_SALT_ROUNDS);
    const cancelToken = randomUUID();

    // 7. Atomic: mark slot booked + create booking
    return prisma.$transaction(async (tx) => {
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
  }

  async cancelBooking(cancelToken: string) {
    const booking = await prisma.booking.findUnique({ where: { cancelToken } });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.status === BookingStatus.CANCELLED) {
      throw new BadRequestException('Booking is already cancelled');
    }

    await prisma.$transaction([
      prisma.booking.update({
        where: { id: booking.id },
        data: { status: BookingStatus.CANCELLED },
      }),
      prisma.availabilitySlot.updateMany({
        where: { bookingId: booking.id },
        data: { booked: false, bookingId: null },
      }),
    ]);

    return { cancelled: true };
  }

  async getAvailableSlots(clinicId: string, date: string) {
    return prisma.availabilitySlot.findMany({
      where: { clinicId, date, booked: false },
      select: { id: true, time: true },
      orderBy: { time: 'asc' },
    });
  }
}
