/**
 * Boot-graph regression: the whole AppModule dependency graph must resolve.
 *
 * Why: Sprint ROUTE-1b added ComplaintsModule with a controller guarded by
 * StaffJwtGuard but without importing AuthModule (the JwtService provider).
 * Every unit test passed, typecheck passed, build passed — and `node dist/main`
 * died with "Nest can't resolve dependencies of the StaffJwtGuard" on the
 * first real boot (CI E2E job, 2026-09-12), after the staging deploy had
 * already reported success (it only polls the web route).
 *
 * Scope: the feature modules, compiled individually — not AppModule. Compiling
 * AppModule hangs in Jest (an async provider factory waits on a connection
 * that never comes without infra), so the whole-graph check stays with the CI
 * E2E job's real `node dist/main` boot. This test is the fast, infra-free
 * version for the modules that were actually wrong, and any module added to
 * MODULES gets the same check. No listen(), no onModuleInit, no DB.
 */
import { Test } from '@nestjs/testing';

// otplib 13 is ESM-only (@scure base32) and Jest's CJS transform chokes on it.
// The DI graph doesn't call it; auth tests mock it the same way.
jest.mock('otplib', () => ({
  authenticator: { verify: () => false, generateSecret: () => 'x', keyuri: () => '', check: () => false },
}));

import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { ComplaintsModule } from '../complaints/complaints.module';
import { SatisfactionSurveyModule } from '../satisfaction-survey/satisfaction-survey.module';

const MODULES = [ComplaintsModule, SatisfactionSurveyModule];

describe('feature-module dependency graphs', () => {
  for (const m of MODULES) {
    it(`${m.name} resolves every provider (guards included)`, async () => {
      // Same globals AppModule supplies (ConfigModule.forRoot isGlobal, @Global PrismaModule);
      // everything else a feature module needs it must import itself — that is the check.
      const mod = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            isGlobal: true,
            ignoreEnvFile: true,
            // Only what AuthModule's constructors validate; never real values.
            load: [() => ({ JWT_SECRET: 'a'.repeat(64), STAFF_TOTP_KEY: '0'.repeat(64), REDIS_URL: 'redis://127.0.0.1:1' })],
          }),
          PrismaModule,
          m,
        ],
      }).compile();
      expect(mod).toBeDefined();
      await mod.close();
    }, 30_000);
  }
});
