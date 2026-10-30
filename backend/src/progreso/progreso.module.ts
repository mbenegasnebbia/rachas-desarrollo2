import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Checkin, CheckinSchema } from '../checkins/schemas/checkin.schema';
import { Persona, PersonaSchema } from '../personas/schemas/persona.schema';
import { Desafio, DesafioSchema } from '../desafios/schemas/desafio.schema';
import { ProgresoService } from './progreso.service';
import { ProgresoController } from './progreso.controller';
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Checkin.name, schema: CheckinSchema },
      { name: Persona.name, schema: PersonaSchema },
      { name: Desafio.name, schema: DesafioSchema },
    ]),
  ],
  providers: [ProgresoService],
  controllers: [ProgresoController],
})
export class ProgresoModule {}
