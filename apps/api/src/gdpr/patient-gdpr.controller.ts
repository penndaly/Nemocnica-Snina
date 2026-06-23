/**
 * Patient GDPR API — /api/gdpr/patient/** + signed download (Sprint A3).
 * Staff-JWT guarded. Export: administrator|super_admin. Erasure: super_admin
 * (the service also enforces this and an MFA re-verify).
 */
import { Body, Controller, Get, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { StaffJwtGuard, StaffRolesGuard, StaffRoles, type StaffContext } from '../auth/staff-jwt.guard';
import { PatientGdprService } from './patient-gdpr.service';
import { StorageService } from './storage.service';

interface StaffReq { staff: StaffContext; headers?: Record<string, string | string[] | undefined>; ip?: string }
interface ReplyLike { header: (k: string, v: string) => void; send: (b: unknown) => void }
function actorOf(req: StaffReq) { return { staffId: req.staff.staffId, email: req.staff.email, role: req.staff.role }; }
function ipOf(req: StaffReq) { const f = req.headers?.['x-forwarded-for']; return (Array.isArray(f) ? f[0] : f) ?? req.ip; }

@Controller('api/gdpr')
@UseGuards(StaffJwtGuard, StaffRolesGuard)
export class PatientGdprController {
  constructor(private readonly gdpr: PatientGdprService, private readonly storage: StorageService) {}

  @Post('patient/export')
  @StaffRoles('administrator', 'super_admin')
  export(@Body() body: { patientToken: string; requestReference: string }, @Req() req: StaffReq) {
    return this.gdpr.exportPatient(body.patientToken, body.requestReference, actorOf(req), ipOf(req));
  }

  @Post('patient/erasure')
  @StaffRoles('super_admin')
  erase(
    @Body() body: { patientToken: string; reason: string; requestReference: string; totpCode: string },
    @Req() req: StaffReq,
  ) {
    return this.gdpr.erasePatient(body.patientToken, body.reason, body.requestReference, body.totpCode, actorOf(req), ipOf(req));
  }

  @Get('download')
  async download(@Query('id') id: string, @Query('token') token: string, @Res() reply: ReplyLike) {
    const { data, filename, contentType } = await this.storage.downloadAndConsume(id, token);
    reply.header('Content-Type', contentType);
    reply.header('Content-Disposition', `attachment; filename="${filename}"`);
    reply.send(data);
  }
}
