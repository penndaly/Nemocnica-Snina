/**
 * CMS Tools API — /api/cms/tools/**.
 *  - export:   administrator | super_admin
 *  - import:   super_admin only
 *  - reset:    super_admin only (+ confirm string + password re-entry)
 *  - download: signed-token download of an export bundle
 */
import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { StaffJwtGuard, StaffRolesGuard, StaffRoles, type StaffContext } from '../auth/staff-jwt.guard';
import { CmsToolsService } from './cms-tools.service';
import { StorageService } from '../gdpr/storage.service';

interface StaffReq { staff: StaffContext; headers?: Record<string, string | string[] | undefined>; ip?: string }
interface ReplyLike { header: (k: string, v: string) => void; send: (b: unknown) => void }
function actorOf(req: StaffReq) { return { staffId: req.staff.staffId, email: req.staff.email, role: req.staff.role }; }
function ipOf(req: StaffReq) { const f = req.headers?.['x-forwarded-for']; return (Array.isArray(f) ? f[0] : f) ?? req.ip; }

@Controller('api/cms/tools')
@UseGuards(StaffJwtGuard, StaffRolesGuard)
export class CmsToolsController {
  constructor(private readonly tools: CmsToolsService, private readonly storage: StorageService) {}

  @Post('export')
  @StaffRoles('administrator', 'super_admin')
  export(@Req() req: StaffReq) {
    return this.tools.export(actorOf(req), ipOf(req));
  }

  @Post('import')
  @StaffRoles('super_admin')
  import(@Body() body: unknown, @Req() req: StaffReq) {
    return this.tools.import(actorOf(req), body, ipOf(req));
  }

  @Post('reset')
  @StaffRoles('super_admin')
  reset(@Body() body: { confirm: string; password: string }, @Req() req: StaffReq) {
    return this.tools.reset(actorOf(req), body?.confirm, body?.password, ipOf(req));
  }

  // Signed-token download (no role guard re-check — the token is the capability).
  @Get('download')
  async download(@Query('id') id: string, @Query('token') token: string, @Res() reply: ReplyLike) {
    const { data, filename, contentType } = await this.storage.downloadAndConsume(id, token);
    reply.header('Content-Type', contentType);
    reply.header('Content-Disposition', `attachment; filename="${filename}"`);
    reply.send(data);
  }
}
