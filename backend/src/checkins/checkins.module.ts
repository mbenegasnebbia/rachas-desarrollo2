import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { CheckinsService } from './checkins.service';
import { CheckinsController } from './checkins.controller';

import { Checkin, CheckinSchema } from './schemas/checkin.schema';
import { Desafio, DesafioSchema } from '../desafios/schemas/desafio.schema';
import { Persona, PersonaSchema } from '../personas/schemas/persona.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Checkin.name, schema: CheckinSchema },
      { name: Desafio.name, schema: DesafioSchema },
      { name: Persona.name, schema: PersonaSchema },
    ]),
  ],
  controllers: [CheckinsController],
  providers: [CheckinsService],
})
export class CheckinsModule {}