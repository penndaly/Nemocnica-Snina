import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { AuditService } from '../audit/audit.service';

interface RequestWithUser {
  user?: { userId: string; email: string; role: string };
  ip?: string;
}

@Controller('api/admin/telehealth')
@UseGuards(AuthGuard('jwt'))
export class TelehealthAdminController {
  private readonly strapiUrl: string;
  private readonly strapiToken: string;

  constructor(
    private readonly cfg: ConfigService,
    private readonly audit: AuditService,
  ) {
    this.strapiUrl   = cfg.get<string>('STRAPI_URL')       ?? 'http://localhost:1337';
    this.strapiToken = cfg.get<string>('STRAPI_API_TOKEN') ?? '';
  }

  private assertAdminOrClinician(role: string | undefined) {
    if (!role || !['ADMIN', 'CLINICIAN'].includes(role)) {
      throw new ForbiddenException('Only admins and clinicians can access telehealth config');
    }
  }

  // ── Clinics ──────────────────────────────────────────────────────────────────

  @Get('clinics')
  async listClinics(@Req() req: RequestWithUser) {
    this.assertAdminOrClinician(req.user?.role);

    const res = await fetch(
      `${this.strapiUrl}/api/clinics?fields[0]=name&fields[1]=telehealth&fields[2]=telehealthWindow&fields[3]=telehealthRule&pagination[limit]=100`,
      { headers: { Authorization: `Bearer ${this.strapiToken}` } },
    );
    if (!res.ok) throw new BadRequestException('Failed to fetch clinics from CMS');

    const data = await res.json() as { data: Array<{ id: string | number; attributes: Record<string, unknown> }> };
    return (data.data ?? []).map((c) => ({
      id:                c.id,
      name:              c.attributes['name'],
      telehealth:        Boolean(c.attributes['telehealth']),
      telehealthWindow:  c.attributes['telehealthWindow'] ?? null,
      telehealthRule:    c.attributes['telehealthRule'] ?? null,
    }));
  }

  @Patch('clinics/:id')
  async updateClinic(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Req() req: RequestWithUser,
  ) {
    this.assertAdminOrClinician(req.user?.role);

    const allowed = ['telehealth', 'telehealthWindow', 'telehealthRule'];
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body) updates[key] = body[key];
    }
    if (Object.keys(updates).length === 0) {
      throw new BadRequestException('No valid fields to update');
    }

    const res = await fetch(`${this.strapiUrl}/api/clinics/${id}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${this.strapiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ data: updates }),
    });
    if (!res.ok) throw new BadRequestException(`Strapi update failed: ${res.status}`);

    await this.audit.log({
      actorEmail: req.user?.email ?? 'unknown',
      actorRole:  req.user?.role ?? 'ADMIN',
      action:     'admin.telehealth.clinic.updated',
      resource:   'clinic',
      resourceId: id,
      detail:     updates,
      ip:         req.ip,
    });

    return { ok: true, id, updates };
  }

  // ── Physicians ───────────────────────────────────────────────────────────────

  @Get('physicians')
  async listPhysicians(@Req() req: RequestWithUser) {
    this.assertAdminOrClinician(req.user?.role);

    const res = await fetch(
      `${this.strapiUrl}/api/physicians?fields[0]=name&fields[1]=specialty&fields[2]=telehealth&pagination[limit]=200`,
      { headers: { Authorization: `Bearer ${this.strapiToken}` } },
    );
    if (!res.ok) throw new BadRequestException('Failed to fetch physicians from CMS');

    const data = await res.json() as { data: Array<{ id: string | number; attributes: Record<string, unknown> }> };
    return (data.data ?? []).map((p) => ({
      id:         p.id,
      name:       p.attributes['name'],
      specialty:  p.attributes['specialty'],
      telehealth: Boolean(p.attributes['telehealth']),
    }));
  }

  @Patch('physicians/:id')
  async updatePhysician(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Req() req: RequestWithUser,
  ) {
    this.assertAdminOrClinician(req.user?.role);

    if (typeof body['telehealth'] !== 'boolean') {
      throw new BadRequestException('telehealth (boolean) is required');
    }

    const res = await fetch(`${this.strapiUrl}/api/physicians/${id}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${this.strapiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ data: { telehealth: body['telehealth'] } }),
    });
    if (!res.ok) throw new BadRequestException(`Strapi update failed: ${res.status}`);

    await this.audit.log({
      actorEmail: req.user?.email ?? 'unknown',
      actorRole:  req.user?.role ?? 'ADMIN',
      action:     'admin.telehealth.physician.updated',
      resource:   'physician',
      resourceId: id,
      detail:     { telehealth: body['telehealth'] },
      ip:         req.ip,
    });

    return { ok: true, id, telehealth: body['telehealth'] };
  }
}
