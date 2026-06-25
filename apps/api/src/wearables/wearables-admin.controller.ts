/**
 * Wearables platform-management API — /api/admin/wearables/platforms (A4, Part C1).
 * super_admin only: platform toggles affect every patient and credentials are
 * sensitive. The connection test is a read-only infra health check (not audited).
 */
import { Body, Controller, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { StaffJwtGuard, StaffRoles, StaffRolesGuard, type StaffContext } from '../auth/staff-jwt.guard';
import { WearablesAdminService } from './wearables-admin.service';
import type { StaffActor } from '../booking/booking-admin.service';

interface StaffReq {
  staff: StaffContext;
  headers?: Record<string, string | string[] | undefined>;
  ip?: string;
}
function actorOf(req: StaffReq): StaffActor {
  return { staffId: req.staff.staffId, email: req.staff.email, role: req.staff.role, scopes: req.staff.scopes ?? [] };
}
function ipOf(req: StaffReq): string | undefined {
  const fwd = req.headers?.['x-forwarded-for'];
  return (Array.isArray(fwd) ? fwd[0] : fwd) ?? req.ip;
}

@Controller('api/admin/wearables/platforms')
@UseGuards(StaffJwtGuard, StaffRolesGuard)
@StaffRoles('super_admin')
export class WearablesAdminController {
  constructor(private readonly admin: WearablesAdminService) {}

  @Get()
  list() {
    return this.admin.getPlatforms();
  }

  @Put(':platformId/enabled')
  setEnabled(
    @Param('platformId') platformId: string,
    @Body() body: { enabled: boolean },
    @Req() req: StaffReq,
  ) {
    return this.admin.togglePlatform(actorOf(req), platformId, !!body.enabled, ipOf(req));
  }

  @Post(':platformId/test')
  test(@Param('platformId') platformId: string) {
    return this.admin.testConnection(platformId);
  }
}
