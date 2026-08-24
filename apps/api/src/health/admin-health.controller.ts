/**
 * GET /api/admin/health — single aggregator for the integration & infra
 * dashboard (Sprint: Integration health dashboard).
 *
 * administrator | super_admin: the report names providers, queue depths and
 * credential-configured flags — operational detail that should not be public.
 * It deliberately contains no secrets and no patient-identifying data.
 */
import { Controller, Get, UseGuards } from '@nestjs/common';
import { StaffJwtGuard, StaffRoles, StaffRolesGuard } from '../auth/staff-jwt.guard';
import { AdminHealthService, type AdminHealthReport } from './admin-health.service';

@Controller('api/admin/health')
@UseGuards(StaffJwtGuard, StaffRolesGuard)
@StaffRoles('administrator', 'super_admin')
export class AdminHealthController {
  constructor(private readonly health: AdminHealthService) {}

  @Get()
  report(): Promise<AdminHealthReport> {
    return this.health.report();
  }
}
