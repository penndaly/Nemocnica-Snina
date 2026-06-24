/**
 * AliveCor KardiaMobile PDF upload (Sprint W2 scaffold).
 *
 * Clinician-only (StaffJwtGuard). Returns 501 Not Implemented until a KardiaPro
 * Enterprise agreement is signed and PDF parsing is wired. Every attempt is
 * audited so the access trail exists from day one. metric_type when live: 11524-6.
 */
import { Controller, Post, Req, UseGuards, NotImplementedException } from '@nestjs/common';
import { StaffJwtGuard, type StaffContext } from '../../../auth/staff-jwt.guard';
import { AuditService } from '../../../audit/audit.service';

interface StaffRequest extends Request {
  staff?: StaffContext;
}

@Controller('api/wearables/upload')
export class KardiaUploadController {
  constructor(private readonly audit: AuditService) {}

  @Post('kardia')
  @UseGuards(StaffJwtGuard)
  async uploadKardia(@Req() req: StaffRequest): Promise<never> {
    await this.audit.log({
      actorEmail: req.staff?.email ?? 'staff',
      actorRole: req.staff?.role ?? 'staff',
      action: 'wearable_kardia_upload_attempted',
      resource: 'wearable_device',
      resourceId: 'alivecor',
    });
    throw new NotImplementedException({
      error: 'KARDIA_UPLOAD_NOT_IMPLEMENTED',
      note: 'Pending KardiaPro Enterprise agreement.',
    });
  }
}
