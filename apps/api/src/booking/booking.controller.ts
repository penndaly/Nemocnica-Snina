import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { BookingService } from './booking.service';
import { BookingRulesService } from './booking-rules.service';
import { CmsClinicService } from '../cms/cms-clinic.service';

@Controller('api/booking')
export class BookingController {
  constructor(
    private readonly bookingService: BookingService,
    private readonly rules: BookingRulesService,
    private readonly cms: CmsClinicService,
  ) {}

  @Get('available-dates')
  async getAvailableDates(@Query('clinicId') clinicId: string) {
    const clinic = await this.cms.getClinicById(clinicId);
    if (!clinic) return { dates: [] };
    return { dates: this.rules.nextAvailableDates(clinic) };
  }

  @Get('slots')
  async getSlots(@Query('clinicId') clinicId: string, @Query('date') date: string) {
    return this.bookingService.getAvailableSlots(clinicId, date);
  }

  @Get('clinics')
  async listBookableClinics() {
    const all = await this.cms.getAllClinics();
    return all.filter((c) => c.bookable && c.status !== 'closed');
  }

  @Post()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  async createBooking(@Body() body: Record<string, unknown>) {
    const clinicId = String(body['clinicId'] ?? '');
    const clinic = await this.cms.getClinicById(clinicId);
    if (!clinic) throw new NotFoundException(`Clinic not found: ${clinicId}`);

    // Validate before handing off — gives a clear 400 if input is missing
    if (!body['date'] || !body['time'] || !body['patientName'] || !body['patientPhone'] || !body['patientRc']) {
      throw new BadRequestException('Missing required booking fields');
    }

    return this.bookingService.createBooking(clinic, {
      clinicId,
      date:             String(body['date']   ?? ''),
      time:             String(body['time']   ?? ''),
      patientName:      String(body['patientName']  ?? ''),
      patientPhone:     String(body['patientPhone'] ?? ''),
      patientRc:        String(body['patientRc']    ?? ''),
      hasReferral:      Boolean(body['hasReferral']),
      gdprConsent:      Boolean(body['gdprConsent']),
      referralConsent:  Boolean(body['referralConsent']),
      locale:           body['locale'] ? String(body['locale']) : undefined,
    });
  }

  @Post('cancel/:token')
  async cancelBooking(@Param('token') token: string) {
    return this.bookingService.cancelBooking(token);
  }
}
