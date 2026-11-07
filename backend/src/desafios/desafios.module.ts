import { SolicitudesAccesoService } from './solicitudesAcceso.service';
import { SolicitudesAccesoController } from './solicitudesAcceso.controller';
import {
  SolicitudAcceso,
  SolicitudAccesoSchema,
} from './schemas/solicitudAcceso.schema';
import { RealtimeEventsModule } from '../realtime/realtime-events.module';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { DesafiosService } from './desafios.service';
import { DesafiosController } from './desafios.controller';

import { Desafio, DesafioSchema } from './schemas/desafio.schema';
import { Persona, PersonaSchema } from '../personas/schemas/persona.schema';

@Module({
  imports: [
    RealtimeEventsModule,
    MongooseModule.forFeature([
      { name: Desafio.name, schema: DesafioSchema },
      { name: SolicitudAcceso.name, schema: SolicitudAccesoSchema },
      { name: Persona.name, schema: PersonaSchema },
    ]),
  ],
  controllers: [DesafiosController, SolicitudesAccesoController],
  providers: [DesafiosService, SolicitudesAccesoService],
})
export class DesafiosModule {}
