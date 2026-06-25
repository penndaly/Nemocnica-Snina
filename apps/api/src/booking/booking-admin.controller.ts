/**
 * Admin booking-management API — /api/admin/bookings (Sprint A4, Part B).
 *
 * StaffJwtGuard authenticates; StaffRolesGuard gates coarse roles. Clinic-level
 * scoping for the clinician role is enforced in the service (per-booking clinic
 * check). Reschedule is administrator+ only (cross-slot moves exceed a clinician's
 * scope). The actor always comes from the verified JWT (req.staff), never the body.
 */
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { StaffJwtGuard, StaffRoles, StaffRolesGuard, type StaffContext } from '../auth/staff-jwt.guard';
import { BookingAdminService, type StaffActor } from './booking-admin.service';
import {
  BookingDtoStatus,
  CancelBookingDto,
  ListBookingsQuery,
  RescheduleBookingDto,
} from './booking-admin.dto';

interface StaffReq {
  staff: StaffContext;
  headers?: Record<string, string | string[] | undefined>;
  ip?: string;
}

function actorOf(req: StaffReq): StaffActor {
  return {
    staffId: req.staff.staffId,
    email: req.staff.email,
    role: req.staff.role,
    scopes: req.staff.scopes ?? [],
  };
}
function ipOf(req: StaffReq): string | undefined {
  const fwd = req.headers?.['x-forwarded-for'];
  return (Array.isArray(fwd) ? fwd[0] : fwd) ?? req.ip;
}

@Controller('api/admin/bookings')
@UseGuards(StaffJwtGuard, StaffRolesGuard)
export class BookingAdminController {
  constructor(private readonly bookings: BookingAdminService) {}

  @Get()
  @StaffRoles('clinician', 'administrator', 'super_admin')
  list(
    @Req() req: StaffReq,
    @Query('clinicId') clinicId?: string,
    @Query('departmentId') departmentId?: string,
    @Query('physicianId') physicianId?: string,
    @Query('status') status?: BookingDtoStatus,
    @Query('date') date?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const q: ListBookingsQuery = {
      clinicId,
      departmentId,
      physicianId,
      status,
      date,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    };
    return this.bookings.list(actorOf(req), q);
  }

  @Get('stats')
  @StaffRoles('clinician', 'administrator', 'super_admin')
  stats(@Req() req: StaffReq) {
    return this.bookings.stats(actorOf(req));
  }

  @Post(':id/cancel')
  @StaffRoles('clinician', 'administrator', 'super_admin')
  cancel(@Param('id') id: string, @Body() dto: CancelBookingDto, @Req() req: StaffReq) {
    return this.bookings.cancel(actorOf(req), id, dto, ipOf(req));
  }

  @Post(':id/reschedule')
  @StaffRoles('administrator', 'super_admin')
  reschedule(@Param('id') id: string, @Body() dto: RescheduleBookingDto, @Req() req: StaffReq) {
    return this.bookings.reschedule(actorOf(req), id, dto, ipOf(req));
  }

  @Post(':id/no-show')
  @StaffRoles('clinician', 'administrator', 'super_admin')
  noShow(@Param('id') id: string, @Req() req: StaffReq) {
    return this.bookings.noShow(actorOf(req), id, ipOf(req));
  }
}
