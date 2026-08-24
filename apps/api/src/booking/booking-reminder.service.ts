/**
 * Booking reminder scheduler — fires 48h before each appointment.
 *
 * Runs as a NestJS scheduled task (cron every hour). On each tick it finds
 * all PENDING/CONFIRMED bookings whose appointment falls in the window
 * [now+47h, now+49h] and hasn't already received a reminder SMS.
 *
 * Idempotency: a `reminderSent` boolean on the Booking model (see schema
 * migration below) is flipped atomically before the SMS so a restart or
 * duplicate tick never sends a second message.
 *
 * Schema addition required (add to prisma/schema.prisma):
 *   reminderSent Boolean @default(false)
 */
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { SmsService } from '../sms/sms.service';
import { CronHeartbeatService } from '../health/cron-heartbeat.service';

const REMINDER_WINDOW_MS = 2 * 60 * 60 * 1000; // ±1h around the 48h mark

@Injectable()
export class BookingReminderService {
  private readonly logger = new Logger(BookingReminderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sms: SmsService,
    private readonly heartbeat: CronHeartbeatService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async sendReminders(): Promise<void> {
    await this.heartbeat.track('booking.reminders', () => this.runSendReminders());
  }

  private async runSendReminders(): Promise<void> {
    const now = new Date();
    const windowStart = new Date(now.getTime() + 47 * 60 * 60 * 1000);
    const windowEnd   = new Date(now.getTime() + 49 * 60 * 60 * 1000);

    // Coarse date pre-filter (YYYY-MM-DD), widened a day each side: booking.date
    // is a local date string while the window is UTC-derived, so a booking near a
    // UTC/local day boundary could otherwise fall outside this pre-filter and
    // never reach the exact-ms check below. The exact check keeps precision.
    const startDate = new Date(windowStart.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)!;
    const endDate   = new Date(windowEnd.getTime()   + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)!;

    const bookings = await this.prisma.booking.findMany({
      where: {
        date:         { gte: startDate, lte: endDate },
        status:       { in: ['PENDING', 'CONFIRMED'] },
        reminderSent: false,
      },
    });

    for (const booking of bookings) {
      // Filter to those whose exact datetime is within the window
      const apptMs = new Date(`${booking.date}T${booking.time}:00`).getTime();
      if (apptMs < windowStart.getTime() || apptMs > windowEnd.getTime()) continue;

      // Atomically mark sent before dispatching to avoid double-send
      const updated = await this.prisma.booking.updateMany({
        where: { id: booking.id, reminderSent: false },
        data:  { reminderSent: true },
      });
      if (updated.count === 0) continue; // another process beat us

      try {
        await this.sms.sendBookingReminder({
          phone:      booking.patientPhone,
          clinicName: booking.clinicId,
          date:       booking.date,
          time:       booking.time,
        });
        this.logger.log(`Reminder sent for booking ${booking.id}`);
      } catch (err) {
        // Roll back the flag so we retry on the next tick
        await this.prisma.booking.update({
          where: { id: booking.id },
          data:  { reminderSent: false },
        });
        this.logger.error(`Failed to send reminder for ${booking.id}: ${String(err)}`);
      }
    }
  }
}
