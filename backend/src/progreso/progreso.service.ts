import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Persona } from '../personas/schemas/persona.schema';
import { Desafio } from '../desafios/schemas/desafio.schema';
import { Checkin } from '../checkins/schemas/checkin.schema';
import { estadisticas, estadoDe, hoyEn } from '../common/calendario';
@Injectable()
export class ProgresoService {
  constructor(
    @InjectModel(Persona.name) private personas: Model<Persona>,
    @InjectModel(Desafio.name) private desafios: Model<Desafio>,
    @InjectModel(Checkin.name) private checkins: Model<Checkin>,
  ) {}
  private validar(...ids: string[]) {
    if (ids.some((id) => !id || !Types.ObjectId.isValid(id)))
      throw new BadRequestException('ID inválido');
  }
  async ranking(id: string) {
    this.validar(id);
    const desafio = await this.desafios.findById(id);
    if (!desafio) throw new NotFoundException('Desafío no encontrado');
    const [personas, checkins] = await Promise.all([
      this.personas.find({ _id: { $in: desafio.participantes } }),
      this.checkins.find({ desafio: desafio._id }),
    ]);
    const items = personas
      .map((p) => ({
        personaId: p._id.toString(),
        alias: p.alias,
        nombre: p.nombre,
        ...estadisticas(
          checkins.filter((c) => c.persona.toString() === p._id.toString()),
          hoyEn(p.zonaHoraria),
        ),
      }))
      .sort(
        (a, b) =>
          b.puntos - a.puntos ||
          b.rachaActual - a.rachaActual ||
          (a.alias < b.alias ? -1 : a.alias > b.alias ? 1 : 0),
      )
      .map((p, i) => ({ ...p, posicion: i + 1 }));
    return {
      items,
      ganador: estadoDe(desafio) === 'FINALIZADO' ? (items[0] ?? null) : null,
    };
  }
  async racha(id: string, personaId: string) {
    this.validar(id, personaId);
    const [desafio, persona] = await Promise.all([
      this.desafios.findById(id),
      this.personas.findById(personaId),
    ]);
    if (!desafio || !persona)
      throw new NotFoundException('Persona o desafío no encontrado');
    return estadisticas(
      await this.checkins.find({ desafio: desafio._id, persona: persona._id }),
      hoyEn(persona.zonaHoraria),
    );
  }
  private async dePersona(id: string) {
    this.validar(id);
    const persona = await this.personas.findById(id);
    if (!persona) throw new NotFoundException('Persona no encontrada');
    return this.desafios.find({ participantes: persona._id });
  }
  async resumen(id: string) {
    const desafios = (await this.dePersona(id)).filter((d) =>
      ['PROGRAMADO', 'ACTIVO'].includes(estadoDe(d)),
    );
    return Promise.all(
      desafios.map(async (d) => {
        const ranking = await this.ranking(d._id.toString());
        return {
          desafio: d,
          estado: estadoDe(d),
          ...ranking.items.find((p) => p.personaId === id),
        };
      }),
    );
  }
  async resultados(id: string) {
    const desafios = (await this.dePersona(id)).filter(
      (d) => estadoDe(d) === 'FINALIZADO',
    );
    return Promise.all(
      desafios.map(async (d) => {
        const ranking = await this.ranking(d._id.toString());
        return {
          desafio: d,
          resultado: ranking.items.find((p) => p.personaId === id),
          ganador: ranking.ganador,
        };
      }),
    );
  }
}
