// IMPORTANT : Sentry doit être initialisé avant tout autre import.
import './instrument.js';

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: true,
  });

  app.setGlobalPrefix('api');
  app.use(helmet());
  // Avatars en data URL : on relève la limite par défaut (100 Ko).
  app.useBodyParser('json', { limit: '1mb' });

  // Derrière un reverse proxy (Render, Fly, Nginx…), nécessaire pour que le rate limiting voie la vraie IP.
  app.set('trust proxy', 1);

  const origins = (process.env.CORS_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  // L'app mobile n'envoie pas d'en-tête Origin : CORS ne concerne que d'éventuels clients web.
  app.enableCors({ origin: origins.length ? origins : false });

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.enableShutdownHooks();

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');
}

await bootstrap();
