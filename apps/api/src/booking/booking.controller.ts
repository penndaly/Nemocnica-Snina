import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { BookingService } from './booking.service';
import { BookingRulesService } from './booking-rules.service';

/** Stub: in production, clinics come from CMS/DB */
import { CLINICS_SEED } from '../config/seed-clinics';

@Controller('api/booking')
export class BookingController {
  constructor(
    private readonly bookingService: BookingService,
    private readonly rules: BookingRulesService,
  ) {}

  @Get('available-dates')
  getAvailableDates(@Query('clinicId') clinicId: string) {
    const clinic = CLINICS_SEED.find((c) => c.id === clinicId);
    if (!clinic) return { dates: [] };
    return { dates: this.rules.nextAvailableDates(clinic) };
  }

  @Get('slots')
  async getSlots(@Query('clinicId') clinicId: string, @Query('date') date: string) {
    return this.bookingService.getAvailableSlots(clinicId, date);
  }

  @Post()
  @Throttle({ default: { ttl: 60_000, limit: 5 } }) // 5 bookings/min per IP
  async createBooking(@Body() body: Record<string, unknown>) {
    const clinicId = String(body['clinicId'] ?? '');
    const clinic = CLINICS_SEED.find((c) => c.id === clinicId);
    if (!clinic) throw new Error('Unknown clinic');

    return this.bookingService.createBooking(clinic, {
      clinicId,
      date: String(body['date'] ?? ''),
      time: String(body['time'] ?? ''),
      patientName: String(body['patientName'] ?? ''),
      patientPhone: String(body['patientPhone'] ?? ''),
      patientRc: String(body['patientRc'] ?? ''),
      hasReferral: Boolean(body['hasReferral']),
      gdprConsent: Boolean(body['gdprConsent']),
      referralConsent: Boolean(body['referralConsent']),
    });
  }

  @Post('cancel/:token')
  async cancelBooking(@Param('token') token: string) {
    return this.bookingService.cancelBooking(token);
  }
}
