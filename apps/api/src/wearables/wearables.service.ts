/**
 * WearablesService — business-logic stubs for Sprint W1.
 *
 * All platform I/O goes through the injected adapter (mock in W1). Real OAuth
 * flows and the background sync job land in W2/W3. The methods here exist so the
 * controller, ConsentGuard and consent engine have a wired collaborator and the
 * 501 endpoints have a clear extension point.
 */
import { Inject, Injectable, NotImplementedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ConsentService } from './consent.service';
import { TokenCryptoService } from './token-crypto.service';
import { WEARABLE_ADAPTER, type WearablePlatformAdapter } from './platform-adapter.interface';

@Injectable()
export class WearablesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly consent: ConsentService,
    private readonly crypto: TokenCryptoService,
    @Inject(WEARABLE_ADAPTER) private readonly adapter: WearablePlatformAdapter,
  ) {}

  /** GET /api/wearables — list the patient's connected devices. (W4) */
  listDevices(_patientToken: string): never {
    throw new NotImplementedException('Wearables device list lands in Sprint W4');
  }

  /** POST /api/wearables/connect/:platform — start an OAuth flow. (W2/W3) */
  connect(_patientToken: string, _platform: string): never {
    throw new NotImplementedException('Device connect (OAuth) lands in Sprint W2/W3');
  }

  /** GET /api/wearables/callback/:platform — OAuth redirect handler. (W2/W3) */
  handleCallback(_platform: string, _code: string, _state: string): never {
    throw new NotImplementedException('OAuth callback lands in Sprint W2/W3');
  }

  /** DELETE /api/wearables/devices/:deviceId — disconnect + withdraw consent. (W4) */
  disconnect(_patientToken: string, _deviceId: string): never {
    throw new NotImplementedException('Device disconnect lands in Sprint W4');
  }

  /** GET /api/wearables/devices/:deviceId/readings. (W4) */
  getReadings(_patientToken: string, _deviceId: string): never {
    throw new NotImplementedException('Readings list lands in Sprint W4');
  }

  /** POST /api/wearables/devices/:deviceId/sync — enqueue a sync job. (W2) */
  sync(_patientToken: string, _deviceId: string): never {
    throw new NotImplementedException('On-demand sync lands in Sprint W2');
  }

  /** PUT /api/wearables/devices/:deviceId/consent — update sharing consent. (W4) */
  updateConsent(_patientToken: string, _deviceId: string): never {
    throw new NotImplementedException('Consent update lands in Sprint W4');
  }

  /** GET /api/wearables/physician/:patientToken — clinician summary view. (W5) */
  physicianView(_patientToken: string): never {
    throw new NotImplementedException('Physician view lands in Sprint W5');
  }
}
