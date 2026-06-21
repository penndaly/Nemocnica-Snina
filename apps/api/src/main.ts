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
