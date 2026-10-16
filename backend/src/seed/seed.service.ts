import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { Persona } from '../personas/schemas/persona.schema';
import { Desafio } from '../desafios/schemas/desafio.schema';

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  constructor(
    @InjectModel(Persona.name)
    private personaModel: Model<Persona>,

    @InjectModel(Desafio.name)
    private desafioModel: Model<Desafio>,
  ) {}

  async onApplicationBootstrap() {
    // 1. Crear tres personas si no existen
    const personas = [
      { nombre: 'Lucia', alias: 'lucia_seed', email: 'lucia.seed@example.com' },
      { nombre: 'Pedro', alias: 'pedro_seed', email: 'pedro.seed@example.com' },
      { nombre: 'Sofia', alias: 'sofia_seed', email: 'sofia.seed@example.com' },
    ];

    for (const persona of personas) {
      await this.personaModel.updateOne(
        { alias: persona.alias },
        { $setOnInsert: persona },
        { upsert: true },
      );
    }

    // 2. Recuperar dos personas para que sean creadoras
    const lucia = await this.personaModel.findOne({ alias: 'lucia_seed' });
    const pedro = await this.personaModel.findOne({ alias: 'pedro_seed' });

    if (!lucia || !pedro) {
      throw new Error('No se pudieron crear las personas de prueba');
    }

    // 3. Preparar las fechas de los desafíos
    const inicio = new Date();
    inicio.setDate(inicio.getDate() + 1);

    const fin = new Date(inicio);
    fin.setDate(fin.getDate() + 6);

    // 4. Crear dos desafíos si no existen
    const desafios = [
      {
        nombre: 'Estudiar todos los dias',
        categoria: 'ESTUDIO',
        codigoInvitacion: 'EST001',
        creador: lucia._id,
        participantes: [lucia._id],
      },
      {
        nombre: 'Salir a caminar',
        categoria: 'SALUD',
        codigoInvitacion: 'SAL001',
        creador: pedro._id,
        participantes: [pedro._id],
      },
    ];

    for (const desafio of desafios) {
      await this.desafioModel.updateOne(
        { codigoInvitacion: desafio.codigoInvitacion },
        {
          $setOnInsert: {
            ...desafio,
            fechaInicio: inicio,
            fechaFin: fin,
          },
        },
        { upsert: true },
      );
    }

    console.log('Seed: datos de prueba cargados');
  }
}