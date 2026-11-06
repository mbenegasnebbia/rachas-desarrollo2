import { VersioningModule } from './versioning/versioning.module';
import { RealtimeModule } from './realtime/realtime.module';
import { AuthModule } from './auth/auth.module';
import { ProgresoModule } from './progreso/progreso.module';
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';

import { PersonasModule } from './personas/personas.module';
import { DesafiosModule } from './desafios/desafios.module';
import { CheckinsModule } from './checkins/checkins.module';
import { SeedModule } from './seed/seed.module';

import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { mongoOptions } from './common/mongo-options';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: mongoOptions,
    }),

    VersioningModule,
    AuthModule,
    RealtimeModule,
    ProgresoModule,
    PersonasModule,
    DesafiosModule,
    CheckinsModule,
    SeedModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
