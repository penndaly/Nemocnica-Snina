/**
 * Server-side enforcement of clinic booking rules.
 * All validation runs here — never trust the client.
 */
import { BadRequestException, Injectable, UnprocessableEntityException } from '@nestjs/common';
import type { Clinic, Weekday } from '@ns/types';

export interface ProposedBooking {
  clinicId: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
}

/** A persisted slot row, as seen by admin reschedule validation. */
export interface SlotRow {
  id: string;
  clinicId: string;
  date: string;
  time: string;
  booked: boolean;
}

@Injectable()
export class BookingRulesService {
  /**
   * Validate a proposed booking against the clinic's encoded rules.
   * Throws BadRequestException if any rule is violated.
   */
  validate(clinic: Clinic, proposed: ProposedBooking): void {
    if (!clinic.bookable) {
      throw new BadRequestException(
        `Clinic ${clinic.id} is not bookable (status: ${clinic.status})`,
      );
    }

    if (clinic.status === 'closed' || clinic.status === 'alert') {
      throw new BadRequestException(
        `Clinic ${clinic.id} is currently ${clinic.status} and cannot be booked`,
      );
    }

    const date = new Date(proposed.date + 'T00:00:00');
    if (isNaN(date.getTime())) {
      throw new BadRequestException('Invalid date format');
    }

    // Reject past dates (server clock, not client)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date < today) {
      throw new BadRequestException(
        `Booking date ${proposed.date} is in the past. Only future dates are accepted.`,
      );
    }

    // JS getDay(): Sun=0, Mon=1 … Sat=6 — same encoding as prototype's bookingDays
    const jsDay = date.getDay() as Weekday;

    if (clinic.bookingDays && clinic.bookingDays.length > 0) {
      if (!clinic.bookingDays.includes(jsDay)) {
        throw new BadRequestException(
          `Clinic ${clinic.id} does not accept bookings on weekday ${jsDay}. ` +
            `Allowed days: ${clinic.bookingDays.join(', ')}`,
        );
      }
    }

    if (clinic.bookingWindow) {
      // bookingWindow format: "HH:MM–HH:MM" (e.g. "13:00–14:00")
      const [startStr, endStr] = clinic.bookingWindow.split('–').map((s) => s.trim());
      if (startStr && endStr) {
        const [sh, sm] = startStr.split(':').map(Number);
        const [eh, em] = endStr.split(':').map(Number);
        const [ph, pm] = proposed.time.split(':').map(Number);
        const startMin = (sh ?? 0) * 60 + (sm ?? 0);
        const endMin = (eh ?? 0) * 60 + (em ?? 0);
        const propMin = (ph ?? 0) * 60 + (pm ?? 0);

        if (propMin < startMin || propMin >= endMin) {
          throw new BadRequestException(
            `Clinic ${clinic.id} only accepts bookings between ${clinic.bookingWindow}`,
          );
        }
      }
    }
  }

  /**
   * Admin cancellation gate (Sprint A4). A future, still-active appointment can be
   * cancelled; a past slot cannot (you record a no-show instead). State checks
   * (already cancelled/completed) live in the admin service so it can return 409.
   * Throws 422 for a past slot.
   */
  validateCancellation(booking: { date: string; time: string }, now: Date = new Date()): void {
    if (this.slotDate(booking.date, booking.time) <= now) {
      throw new UnprocessableEntityException({
        code: 'BOOKING_SLOT_IN_PAST',
        message: 'Cannot cancel a past appointment — record a no-show instead.',
      });
    }
  }

  /**
   * Admin reschedule gate (Sprint A4). The new slot must belong to the same clinic,
   * be free, and be in the future. Throws 422 otherwise.
   */
  validateSlotAvailability(slot: SlotRow | null, clinicId: string, now: Date = new Date()): void {
    if (!slot) {
      throw new UnprocessableEntityException({ code: 'SLOT_NOT_FOUND', message: 'Target slot does not exist.' });
    }
    if (slot.clinicId !== clinicId) {
      throw new UnprocessableEntityException({ code: 'SLOT_DIFFERENT_CLINIC', message: 'New slot must be in the same clinic.' });
    }
    if (slot.booked) {
      throw new UnprocessableEntityException({ code: 'SLOT_UNAVAILABLE', message: 'Target slot is already booked.' });
    }
    if (this.slotDate(slot.date, slot.time) <= now) {
      throw new UnprocessableEntityException({ code: 'SLOT_IN_PAST', message: 'Target slot is in the past.' });
    }
  }

  /**
   * No-show gate (Sprint A4): the slot must be in the past or within 30 minutes of
   * its start — you cannot pre-emptively mark a future appointment as a no-show.
   */
  validateNoShow(booking: { date: string; time: string }, now: Date = new Date()): void {
    const graceMs = 30 * 60 * 1000;
    if (this.slotDate(booking.date, booking.time).getTime() - now.getTime() > graceMs) {
      throw new UnprocessableEntityException({
        code: 'BOOKING_NOT_DUE',
        message: 'A no-show can only be recorded from 30 minutes before the appointment.',
      });
    }
  }

  /** Combine a YYYY-MM-DD date and HH:MM time into a local Date. */
  slotDate(date: string, time: string): Date {
    return new Date(`${date}T${(time || '00:00').padStart(5, '0')}:00`);
  }

  /**
   * Generate the next N dates that fall on an allowed weekday for this clinic.
   */
  nextAvailableDates(clinic: Clinic, count = 8, from: Date = new Date()): string[] {
    if (!clinic.bookable || !clinic.bookingDays || clinic.bookingDays.length === 0) {
      return [];
    }
    const dates: string[] = [];
    const cursor = new Date(from);
    cursor.setHours(0, 0, 0, 0);
    cursor.setDate(cursor.getDate() + 1); // start from tomorrow

    while (dates.length < count) {
      const day = cursor.getDay() as Weekday;
      if (clinic.bookingDays.includes(day)) {
        const y = cursor.getFullYear();
        const mo = String(cursor.getMonth() + 1).padStart(2, '0');
        const d = String(cursor.getDate()).padStart(2, '0');
        dates.push(`${y}-${mo}-${d}`);
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    return dates;
  }
}
