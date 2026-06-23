/**
 * Translation review API — /api/cms/translations/**.
 * Any authenticated staff role may review (editor|clinician|administrator|super_admin),
 * so StaffJwtGuard alone (no role restriction).
 */
import { Body, Controller, Get, Param, Put, Req, UseGuards } from '@nestjs/common';
import { StaffJwtGuard, type StaffContext } from '../auth/staff-jwt.guard';
import { TranslationService } from './translation.service';

interface StaffReq { staff: StaffContext; headers?: Record<string, string | string[] | undefined>; ip?: string }
function ipOf(req: StaffReq) {
  const f = req.headers?.['x-forwarded-for'];
  return (Array.isArray(f) ? f[0] : f) ?? req.ip;
}

@Controller('api/cms/translations')
@UseGuards(StaffJwtGuard)
export class TranslationController {
  constructor(private readonly translations: TranslationService) {}

  @Get('pending')
  pending() {
    return this.translations.pending();
  }

  @Get(':collection/:id')
  item(@Param('collection') collection: string, @Param('id') id: string) {
    return this.translations.item(collection, id);
  }

  @Put(':collection/:id/:locale/review')
  review(
    @Param('collection') collection: string,
    @Param('id') id: string,
    @Param('locale') locale: string,
    @Body() body: { status: 'approved' | 'rejected'; notes?: string },
    @Req() req: StaffReq,
  ) {
    const actor = { staffId: req.staff.staffId, email: req.staff.email, role: req.staff.role };
    return this.translations.review(collection, id, locale, body, actor, ipOf(req));
  }
}
