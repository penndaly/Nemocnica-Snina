/**
 * Server-side enforcement of clinic booking rules.
 * All validation runs here — never trust the client.
 */
import { BadRequestException, Injectable } from '@nestjs/common';
import type { Clinic, Weekday } from '@ns/types';

export interface ProposedBooking {
  clinicId: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
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
        dates.push(cursor.toISOString().substring(0, 10));
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    return dates;
  }
}
