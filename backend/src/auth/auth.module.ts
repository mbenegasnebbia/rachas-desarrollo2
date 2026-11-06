import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { Persona, PersonaSchema } from '../personas/schemas/persona.schema';
import { FirebasePersonaService } from './firebase-persona.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { FirebaseAdminProvider } from './firebase-admin.provider';
import { FirebaseAuthGuard } from './firebase-auth.guard';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([{ name: Persona.name, schema: PersonaSchema }]),
  ],
  controllers: [AuthController],
  providers: [
    FirebaseAdminProvider,
    AuthService,
    FirebaseAuthGuard,
    FirebasePersonaService,
    { provide: APP_GUARD, useExisting: FirebaseAuthGuard },
  ],
  exports: [AuthService, FirebaseAuthGuard],
})
export class AuthModule {}
