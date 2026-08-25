import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditService } from '../audit/audit.service';
import { StaffJwtGuard, StaffRoles, StaffRolesGuard, type StaffContext } from '../auth/staff-jwt.guard';
import { CLINICS_SEED } from '../config/seed-clinics';

interface RequestWithStaff {
  staff: StaffContext;
  ip?: string;
}

// This controller is exclusively for the production React admin UI
// (apps/web/src/app/admin/telehealth/page.tsx via AdminAuthContext), which
// authenticates through the newer StaffAccount/StaffJwtGuard stack (aud
// 'ns.staff', lowercase roles) — unlike telehealth.controller.ts's
// patient/physician-facing endpoints, which stay on the legacy
// AuthGuard('jwt') strategy shared with the eID/OIDC patient flow (aud
// 'ns.patient') and existing physician JWTs (aud 'ns.staff.legacy').
// This controller had never been migrated: AuthGuard('jwt') rejects a
// StaffJwtGuard-issued token outright (audience mismatch), so every real
// admin/clinician session hit a 401 loading Clinics/Physicians here,
// regardless of role.
@Controller('api/admin/telehealth')
@UseGuards(StaffJwtGuard, StaffRolesGuard)
@StaffRoles('clinician', 'administrator', 'super_admin')
export class TelehealthAdminController {
  private readonly strapiUrl: string;
  private readonly strapiToken: string;
  // Mirrors apps/web/src/lib/strapi-client.ts's USE_FALLBACK: the literal
  // 'dev-token' sentinel is what CI's E2E job sets STRAPI_API_TOKEN to
  // (that job runs no Strapi service at all — see .github/workflows/ci.yml).
  // Without this, listClinics() had no dev/CI path: it always made a real
  // Strapi call and threw BadRequestException on the resulting 401/refused
  // connection, so the admin Clinics tab could never render — not just in
  // this repo's CI, but in any local dev setup without a live, token-
  // provisioned Strapi instance.
  private readonly useFallback: boolean;

  constructor(
    private readonly cfg: ConfigService,
    private readonly audit: AuditService,
  ) {
    this.strapiUrl   = cfg.get<string>('STRAPI_URL')       ?? 'http://localhost:1337';
    this.strapiToken = cfg.get<string>('STRAPI_API_TOKEN') ?? '';
    this.useFallback = !this.strapiToken || this.strapiToken === 'dev-token';
  }

  // ── Clinics ──────────────────────────────────────────────────────────────────

  @Get('clinics')
  async listClinics() {
    if (this.useFallback) {
      return CLINICS_SEED.map((c) => ({
        id:               c.id,
        name:             c.name.sk,
        telehealth:       Boolean(c.telehealth),
        telehealthWindow: c.telehealthWindow ?? null,
        telehealthRule:   c.telehealthRule?.sk ?? null,
      }));
    }

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
    @Req() req: RequestWithStaff,
  ) {
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
      actorEmail: req.staff.email,
      actorRole:  req.staff.role,
      action:     'admin.telehealth.clinic.updated',
      resource:   'clinic',
      resourceId: id,
      detail:     { ...updates, staffAccountId: req.staff.staffId },
      ip:         req.ip,
    });

    return { ok: true, id, updates };
  }

  // ── Physicians ───────────────────────────────────────────────────────────────

  @Get('physicians')
  async listPhysicians() {
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
    @Req() req: RequestWithStaff,
  ) {
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
      actorEmail: req.staff.email,
      actorRole:  req.staff.role,
      action:     'admin.telehealth.physician.updated',
      resource:   'physician',
      resourceId: id,
      detail:     { telehealth: body['telehealth'], staffAccountId: req.staff.staffId },
      ip:         req.ip,
    });

    return { ok: true, id, telehealth: body['telehealth'] };
  }
}
