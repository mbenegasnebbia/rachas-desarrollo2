import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { SeedService } from './seed.service';
import { Persona, PersonaSchema } from '../personas/schemas/persona.schema';
import { Desafio, DesafioSchema } from '../desafios/schemas/desafio.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Persona.name, schema: PersonaSchema },
      { name: Desafio.name, schema: DesafioSchema },
    ]),
  ],
  providers: [SeedService],
})
export class SeedModule {}