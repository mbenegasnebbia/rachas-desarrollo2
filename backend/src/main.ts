import { NestFactory } from '@nestjs/core';
import {
  ValidationPipe,
  VersioningType,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { LegacyUsage } from './versioning/versioning.module';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: ['1', '2', VERSION_NEUTRAL],
  });
  app.enableCors({ exposedHeaders: ['Deprecation', 'Sunset'] });
  const usage = app.get(LegacyUsage);
  app.use(usage.use.bind(usage));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();
