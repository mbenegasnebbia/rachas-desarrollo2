import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { PersonasService } from './personas.service';
import { PersonasController } from './personas.controller';
import { Persona, PersonaSchema } from './schemas/persona.schema';

import { Desafio, DesafioSchema } from '../desafios/schemas/desafio.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Persona.name, schema: PersonaSchema },
      { name: Desafio.name, schema: DesafioSchema },
    ]),
  ],
  controllers: [PersonasController],
  providers: [PersonasService],
})
export class PersonasModule {}