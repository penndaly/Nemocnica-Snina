import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(cfg: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: cfg.getOrThrow<string>('JWT_SECRET'),
      // This strategy backs both patient-facing telehealth endpoints (aud
      // ns.patient) and legacy staff routes (aud ns.staff.legacy). Accept only
      // those two known audiences — a JWT_SECRET-signed token with any other (or
      // missing) audience is rejected. Staff-only routes additionally gate on
      // `role` (patient tokens carry none); patient-facing routes enforce
      // ownership in the service layer.
      audience: ['ns.patient', 'ns.staff.legacy'],
    });
  }

  validate(payload: JwtPayload & { aud?: string | string[] }) {
    return { userId: payload.sub, email: payload.email, role: payload.role, aud: payload.aud };
  }
}
