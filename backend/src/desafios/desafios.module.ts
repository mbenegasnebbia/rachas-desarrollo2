import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { DesafiosService } from './desafios.service';
import { DesafiosController } from './desafios.controller';

import { Desafio, DesafioSchema } from './schemas/desafio.schema';
import { Persona, PersonaSchema } from '../personas/schemas/persona.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Desafio.name, schema: DesafioSchema },
      { name: Persona.name, schema: PersonaSchema },
    ]),
  ],
  controllers: [DesafiosController],
  providers: [DesafiosService],
})
export class DesafiosModule {}