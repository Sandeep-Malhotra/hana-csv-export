import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  // csn.json files can be several MB — raise the body limit
  app.use(require('express').json({ limit: '50mb' }));

  // Replace the default NestJS logger with Winston
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

  // Enable CORS for the Next.js frontend
  app.enableCors({
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: true,
  });

  // Global validation + transformation
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: false,
    }),
  );

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);

  const logger = app.get(WINSTON_MODULE_NEST_PROVIDER);
  logger.log(`HANA Export Backend listening on http://localhost:${port}`, 'Bootstrap');
}

bootstrap().catch((err) => {
  console.error('Fatal startup error', err);
  process.exit(1);
});
