/**
 * Garmin Health API adapter — OAuth 1.0a connect/disconnect ONLY.
 *
 * Garmin is a PUSH platform: readings arrive via the webhook already shipped in
 * W6 (webhooks/garmin.webhook.controller.ts, HMAC-SHA1 + rate-limit). This
 * adapter does NOT duplicate that controller and syncReadings always returns [].
 *
 * Live-mode note: Garmin's 3-legged OAuth 1.0a needs an async request-token call
 * BEFORE the authorize redirect, but the WearablePlatformAdapter.getAuthUrl
 * contract is synchronous. Wiring the full handshake (request_token + signed
 * access_token exchange, with the request-token secret persisted alongside the
 * OAuth state) is deferred to live enablement (WEARABLES_PROVIDER=live, post-L1).
 * Until then the token-exchange methods throw a typed, explicit error rather than
 * pretend to succeed. Disconnect (webhook deregistration) is implemented.
 */
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { WearableDevice } from '@prisma/client';
import type { RawReading, TokenSet, WearablePlatformAdapter } from '../../platform-adapter.interface';
import { TokenCryptoService } from '../../token-crypto.service';
import { WearablesConfigError } from '../../platform-catalog';

const CONFIRM = 'https://connect.garmin.com/oauthConfirm';
const DEREGISTER = 'https://healthapi.garmin.com/wellness-api/rest/user/registration';

@Injectable()
export class GarminAdapter implements WearablePlatformAdapter {
  private readonly consumerKey: string;

  constructor(
    cfg: ConfigService,
    private readonly crypto: TokenCryptoService,
  ) {
    this.consumerKey = cfg.get<string>('GARMIN_CONSUMER_KEY') ?? '';
  }

  getAuthUrl(_patientId: string, state: string): string {
    // The oauth_token is obtained from Garmin's request_token endpoint at live
    // enablement (see file header). The state binds the callback to this patient.
    return `${CONFIRM}?oauth_callback_state=${encodeURIComponent(state)}&oauth_consumer_key=${encodeURIComponent(this.consumerKey)}`;
  }

  async exchangeCode(_code: string, _state: string): Promise<TokenSet> {
    throw new WearablesConfigError('Garmin live OAuth 1.0a handshake is not wired (push platform; enable at L1)');
  }

  /** Push platform — data arrives via the W6 webhook, never by polling. */
  async syncReadings(_device: WearableDevice, _from: Date): Promise<RawReading[]> {
    return [];
  }

  async refreshToken(_device: WearableDevice): Promise<TokenSet> {
    // OAuth 1.0a access tokens do not expire/refresh the way OAuth2 does.
    throw new WearablesConfigError('Garmin OAuth 1.0a tokens are not refreshed (no refresh grant)');
  }

  async revokeToken(device: WearableDevice): Promise<void> {
    if (!device.oauthAccessTokenEnc) return;
    // Deregister the webhook subscription — best-effort; never block withdrawal.
    try {
      const accessToken = this.crypto.decryptToken(device.oauthAccessTokenEnc);
      await fetch(DEREGISTER, { method: 'DELETE', headers: { authorization: `Bearer ${accessToken}` } });
    } catch {
      /* best-effort */
    }
  }
}
