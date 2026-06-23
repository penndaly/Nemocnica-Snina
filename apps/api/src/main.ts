import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { validateConfig } from './config/config.schema';
import { startMockOidcServer } from './oidc-mock/oidc-mock.server';
import { AppModule } from './app.module';
import fastifyHelmet from '@fastify/helmet';

async function bootstrap() {
  // Fail fast on missing/invalid config before anything else starts
  const cfg = validateConfig();

  // Start mock OIDC IdP for dev/CI (no-op in production)
  startMockOidcServer();

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: true }),
  );

await app.register(fastifyHelmet as any, {
    contentSecurityPolicy: false,
  });

  // Multipart support for CMS media uploads (POST /api/cms/media). Registered
  // best-effort: dynamic require keeps the build green if the optional
  // @fastify/multipart dependency is not installed in a given environment.
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const multipart = require('@fastify/multipart');
    await app.register(multipart, { limits: { fileSize: 50 * 1024 * 1024 } });
  } catch {
    // @fastify/multipart unavailable — /api/cms/media returns 503 until installed.
  }

  // Cookie support for the staff refresh token (HttpOnly). Best-effort: the
  // staff auth controller falls back to a body token if the plugin is absent.
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const cookie = require('@fastify/cookie');
    await app.register(cookie);
  } catch {
    // @fastify/cookie unavailable — refresh token returned in body (dev only).
  }

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  app.enableCors({
    origin: process.env['ALLOWED_ORIGINS']?.split(',') ?? ['http://localhost:3000'],
    credentials: true,
  });

  await app.listen(cfg.PORT, '0.0.0.0');
}

void bootstrap();
