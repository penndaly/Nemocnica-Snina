import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TelehealthStatus } from '@prisma/client';
import { TelehealthSessionService } from './telehealth-session.service';

interface RequestWithUser {
  user?: { userId: string; email: string; role: string };
  ip?: string;
}

@Controller('api/telehealth/sessions')
export class TelehealthController {
  constructor(private readonly sessionSvc: TelehealthSessionService) {}

  // POST /api/telehealth/sessions — internal: called by booking service on confirmed telehealth booking
  @Post()
  async createSession(@Body() body: Record<string, unknown>) {
    const bookingId   = String(body['bookingId']   ?? '');
    const clinicId    = String(body['clinicId']    ?? '');
    const physicianId = String(body['physicianId'] ?? '');
    const scheduledAt = body['scheduledAt'] ? new Date(String(body['scheduledAt'])) : null;

    if (!bookingId || !clinicId || !physicianId || !scheduledAt) {
      throw new BadRequestException('bookingId, clinicId, physicianId, scheduledAt are required');
    }

    const sessionId = await this.sessionSvc.createSession({
      bookingId,
      clinicId,
      physicianId,
      scheduledAt,
    });
    return { sessionId };
  }

  // GET /api/telehealth/sessions — staff: list sessions for physician schedule
  @Get()
  @UseGuards(AuthGuard('jwt'))
  async listSessions(
    @Req() req: RequestWithUser,
    @Query('physicianId') physicianId?: string,
    @Query('patient') patient?: string,
    @Query('status') statusRaw?: string,
  ) {
    const statuses = statusRaw
      ? (statusRaw.split(',').filter((s) => s in TelehealthStatus) as TelehealthStatus[])
      : undefined;

    const effectivePhysicianId =
      req.user?.role === 'CLINICIAN' ? req.user.userId : physicianId;

    return this.sessionSvc.listSessions(
      effectivePhysicianId,
      patient === 'me' ? req.user?.userId : patient,
      statuses,
    );
  }

  // GET /api/telehealth/sessions/:id
  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  async getSession(@Param('id') id: string) {
    return this.sessionSvc.getSession(id);
  }

  // POST /api/telehealth/sessions/:id/join — issues join token (patient or physician)
  @Post(':id/join')
  @UseGuards(AuthGuard('jwt'))
  async joinSession(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Req() req: RequestWithUser,
  ) {
    const role = body['role'] === 'physician' ? 'physician' : 'patient';
    const identity = req.user?.email ?? req.user?.userId ?? 'unknown';
    return this.sessionSvc.joinSession(id, identity, role, req.ip);
  }

  // POST /api/telehealth/sessions/:id/admit — physician admits patient (waiting→active)
  @Post(':id/admit')
  @UseGuards(AuthGuard('jwt'))
  async admitPatient(@Param('id') id: string, @Req() req: RequestWithUser) {
    if (!req.user || !['CLINICIAN', 'ADMIN'].includes(req.user.role)) {
      throw new BadRequestException('Only clinicians can admit patients');
    }
    await this.sessionSvc.admitPatient(id, req.user.userId, req.ip);
    return { ok: true };
  }

  // POST /api/telehealth/sessions/:id/end — either party ends the call (active→ended)
  @Post(':id/end')
  @UseGuards(AuthGuard('jwt'))
  async endSession(@Param('id') id: string, @Req() req: RequestWithUser) {
    const actorId = req.user?.email ?? 'unknown';
    await this.sessionSvc.endSession(id, actorId, req.ip);
    return { ok: true };
  }

  // POST /api/telehealth/sessions/:id/cancel
  @Post(':id/cancel')
  @UseGuards(AuthGuard('jwt'))
  async cancelSession(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Req() req: RequestWithUser,
  ) {
    const reason = String(body['reason'] ?? '');
    const actorId = req.user?.email ?? 'unknown';
    await this.sessionSvc.cancelSession(id, actorId, reason, req.ip);
    return { ok: true };
  }

  // POST /api/telehealth/sessions/:id/intake — patient submits pre-call intake form
  @Post(':id/intake')
  @UseGuards(AuthGuard('jwt'))
  async submitIntake(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Req() req: RequestWithUser,
  ) {
    const reason             = String(body['reason']             ?? '');
    const currentMedications = String(body['currentMedications'] ?? '');
    const symptoms           = String(body['symptoms']           ?? '');
    const vitalsNote         = body['vitalsNote'] ? String(body['vitalsNote']) : undefined;

    if (!reason || !currentMedications || !symptoms) {
      throw new BadRequestException('reason, currentMedications, and symptoms are required');
    }

    await this.sessionSvc.submitIntake(id, { reason, currentMedications, symptoms, vitalsNote }, req.ip);
    return { ok: true };
  }

  // GET /api/telehealth/sessions/:id/summary
  @Get(':id/summary')
  @UseGuards(AuthGuard('jwt'))
  async getSummary(@Param('id') id: string, @Req() req: RequestWithUser) {
    const actorId = req.user?.email ?? 'unknown';
    const summary = await this.sessionSvc.getSummary(id, actorId, req.ip);
    if (!summary) throw new NotFoundException(`No summary for session ${id}`);
    return summary;
  }
}
