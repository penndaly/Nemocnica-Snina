/**
 * Wearables REST API — Sprint W1.
 *
 * All patient endpoints are protected by ConsentGuard, which validates the
 * patient session and (for :deviceId routes) enforces 'data_storage' consent.
 * Endpoint bodies are 501 stubs in W1 — the data model, consent engine and
 * config gate are what W1 delivers. Real behaviour lands in W2–W5.
 */
import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConsentGuard } from './consent.guard';
import { WearablesService } from './wearables.service';

interface PatientRequest {
  patientToken?: string;
}

@Controller('api/wearables')
export class WearablesController {
  constructor(private readonly wearables: WearablesService) {}

  // GET /api/wearables — patient's connected devices
  @Get()
  @UseGuards(ConsentGuard)
  list(@Req() req: PatientRequest) {
    return this.wearables.listDevices(req.patientToken ?? '');
  }

  // POST /api/wearables/connect/:platform — begin OAuth → { authUrl }
  @Post('connect/:platform')
  @UseGuards(ConsentGuard)
  connect(@Param('platform') platform: string, @Req() req: PatientRequest) {
    return this.wearables.connect(req.patientToken ?? '', platform);
  }

  // GET /api/wearables/callback/:platform — OAuth redirect (no auth; state-validated)
  @Get('callback/:platform')
  callback(
    @Param('platform') platform: string,
    @Query('code') code: string,
    @Query('state') state: string,
  ) {
    return this.wearables.handleCallback(platform, code, state);
  }

  // DELETE /api/wearables/devices/:deviceId — disconnect device
  @Delete('devices/:deviceId')
  @UseGuards(ConsentGuard)
  disconnect(@Param('deviceId') deviceId: string, @Req() req: PatientRequest) {
    return this.wearables.disconnect(req.patientToken ?? '', deviceId);
  }

  // GET /api/wearables/devices/:deviceId/readings
  @Get('devices/:deviceId/readings')
  @UseGuards(ConsentGuard)
  readings(@Param('deviceId') deviceId: string, @Req() req: PatientRequest) {
    return this.wearables.getReadings(req.patientToken ?? '', deviceId);
  }

  // POST /api/wearables/devices/:deviceId/sync — enqueue a sync job
  @Post('devices/:deviceId/sync')
  @UseGuards(ConsentGuard)
  sync(@Param('deviceId') deviceId: string, @Req() req: PatientRequest) {
    return this.wearables.sync(req.patientToken ?? '', deviceId);
  }

  // PUT /api/wearables/devices/:deviceId/consent — update sharing consent
  @Put('devices/:deviceId/consent')
  @UseGuards(ConsentGuard)
  updateConsent(@Param('deviceId') deviceId: string, @Req() req: PatientRequest) {
    return this.wearables.updateConsent(req.patientToken ?? '', deviceId);
  }

  // GET /api/wearables/physician/:patientToken — clinician summary (staff JWT)
  @Get('physician/:patientToken')
  @UseGuards(AuthGuard('jwt'))
  physicianView(@Param('patientToken') patientToken: string) {
    return this.wearables.physicianView(patientToken);
  }
}
