/**
 * CmsAuthGuard — protects all /api/cms/** (write) routes.
 *
 * Production: delegates to the staff JWT strategy (AuthGuard('jwt')) — the same
 * passport guard used everywhere else for staff endpoints. Combined with
 * MFA_REQUIRED=true, this enforces Decree 179/2020 (MFA for all staff accounts).
 *
 * Dev/CI: when CMS_AUTH_BYPASS=true the guard short-circuits to allow, so the
 * prototype admin can be wired against a local API without a real OIDC+MFA
 * session. The config validator (config.schema.ts) rejects CMS_AUTH_BYPASS=true
 * in production, so the bypass can never ship.
 */
import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CmsAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly cfg: ConfigService) {
    super();
  }

  canActivate(context: ExecutionContext) {
    // ConfigModule holds raw env strings — coerce defensively.
    const bypass = String(this.cfg.get('CMS_AUTH_BYPASS') ?? '').toLowerCase() === 'true';
    if (bypass) return true;
    return super.canActivate(context);
  }
}
