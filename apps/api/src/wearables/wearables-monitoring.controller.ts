/**
 * Wearables monitoring API — /api/admin/wearables/monitoring (A4, Part C2).
 * administrator | super_admin. DPO/admin visibility into device health + alerts,
 * plus global default thresholds (physician per-patient thresholds always override).
 */
import { Body, Controller, Get, Header, Param, Put, Query, Req, UseGuards } from '@nestjs/common';
import { StaffJwtGuard, StaffRoles, StaffRolesGuard, type StaffContext } from '../auth/staff-jwt.guard';
import { WearablesMonitoringService, type AlertLogQuery } from './wearables-monitoring.service';
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
function alertQuery(q: Record<string, string | undefined>): AlertLogQuery {
  return {
    severity: q.severity,
    platformId: q.platformId,
    from: q.from,
    to: q.to,
    page: q.page ? Number(q.page) : undefined,
    limit: q.limit ? Number(q.limit) : undefined,
  };
}

@Controller('api/admin/wearables/monitoring')
@UseGuards(StaffJwtGuard, StaffRolesGuard)
@StaffRoles('administrator', 'super_admin')
export class WearablesMonitoringController {
  constructor(private readonly monitoring: WearablesMonitoringService) {}

  @Get('summary')
  summary() {
    return this.monitoring.summary();
  }

  @Get('alerts')
  alerts(@Query() q: Record<string, string | undefined>) {
    return this.monitoring.alerts(alertQuery(q));
  }

  @Get('alerts/export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="wearable-alerts.csv"')
  export(@Query() q: Record<string, string | undefined>, @Req() req: StaffReq): Promise<string> {
    return this.monitoring.exportCsv(actorOf(req), alertQuery(q), ipOf(req));
  }

  @Get('thresholds/defaults')
  getDefaults() {
    return this.monitoring.getDefaults();
  }

  @Put('thresholds/defaults/:metricType')
  setDefault(
    @Param('metricType') metricType: string,
    @Body() body: { criticalLow?: number | null; criticalHigh?: number | null; highLow?: number | null; highHigh?: number | null },
    @Req() req: StaffReq,
  ) {
    return this.monitoring.setDefault(actorOf(req), metricType, body, ipOf(req));
  }
}
