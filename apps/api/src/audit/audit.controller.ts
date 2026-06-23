/**
 * Audit log read API — /api/audit/** (read-only; no mutation routes exist).
 * Role: administrator | super_admin (StaffJwtGuard + StaffRolesGuard).
 */
import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { StaffJwtGuard, StaffRolesGuard, StaffRoles } from '../auth/staff-jwt.guard';
import { AuditService } from './audit.service';

@Controller('api/audit')
@UseGuards(StaffJwtGuard, StaffRolesGuard)
@StaffRoles('administrator', 'super_admin')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  query(
    @Query('action') action?: string,
    @Query('actorId') actorId?: string,
    @Query('targetType') targetType?: string,
    @Query('targetId') targetId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.audit.query({
      action, actorId, targetType, targetId, from, to,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('staff/:staffId')
  byStaff(@Param('staffId') staffId: string) {
    return this.audit.byStaff(staffId);
  }

  @Get('content/:targetType/:targetId')
  byContent(@Param('targetType') targetType: string, @Param('targetId') targetId: string) {
    return this.audit.byContent(targetType, targetId);
  }
}
