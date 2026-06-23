/**
 * ConsentGuard — applied to all /api/wearables/** endpoints.
 *
 *   1. Validates the patient session JWT (x-patient-session header, or a Bearer
 *      token) and extracts the opaque patient_token (the `sub` claim).
 *   2. For any route carrying a :deviceId param, requires a granted, non-withdrawn
 *      'data_storage' consent for that device — otherwise 403:
 *      { code: 'WEARABLES_CONSENT_REQUIRED', deviceId }.
 *
 * The resolved patient_token is attached to the request as `patientToken`.
 */
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jose from 'jose';
import { ConsentService } from './consent.service';

interface WearableRequest {
  headers: Record<string, string | string[] | undefined>;
  params?: Record<string, string>;
  patientToken?: string;
}

@Injectable()
export class ConsentGuard implements CanActivate {
  private readonly secret: Uint8Array;

  constructor(
    private readonly consent: ConsentService,
    cfg: ConfigService,
  ) {
    this.secret = new TextEncoder().encode(
      cfg.get<string>('JWT_SECRET') ?? 'dev-secret-min-32-chars-long-xxx',
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<WearableRequest>();

    const patientToken = await this.resolvePatientToken(req);
    req.patientToken = patientToken;

    const deviceId = req.params?.['deviceId'];
    if (deviceId) {
      // Throws 403 { code: 'WEARABLES_CONSENT_REQUIRED', deviceId } if absent.
      await this.consent.checkConsent(patientToken, deviceId, 'data_storage');
    }

    return true;
  }

  private async resolvePatientToken(req: WearableRequest): Promise<string> {
    const header = req.headers['x-patient-session'];
    const sessionHeader = Array.isArray(header) ? header[0] : header;

    const authHeader = req.headers['authorization'];
    const auth = Array.isArray(authHeader) ? authHeader[0] : authHeader;
    const bearer = auth?.startsWith('Bearer ') ? auth.slice(7) : undefined;

    const token = sessionHeader ?? bearer;
    if (!token) throw new UnauthorizedException('Missing patient session');

    try {
      const { payload } = await jose.jwtVerify(token, this.secret);
      const sub = String(payload['sub'] ?? '');
      if (!sub) throw new Error('no sub');
      return sub;
    } catch {
      throw new UnauthorizedException('Invalid or expired patient session');
    }
  }
}
