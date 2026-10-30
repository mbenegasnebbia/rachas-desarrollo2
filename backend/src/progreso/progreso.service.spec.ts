import { jest } from '@jest/globals';
import { Model, Types } from 'mongoose';
import { ProgresoService } from './progreso.service';
import { Persona } from '../personas/schemas/persona.schema';
import { Desafio } from '../desafios/schemas/desafio.schema';
import { Checkin } from '../checkins/schemas/checkin.schema';
const a = new Types.ObjectId(),
  b = new Types.ObjectId(),
  c = new Types.ObjectId(),
  desafioId = new Types.ObjectId();
describe('Ranking', () => {
  afterEach(() => jest.useRealTimers());
  it('desempata por puntos, racha y alias, y devuelve ganador al finalizar', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-30T15:00:00Z'));
    const personas = {
      find: () =>
        Promise.resolve([
          { _id: a, alias: 'zeta', nombre: 'Z', zonaHoraria: 'UTC' },
          { _id: b, alias: 'beta', nombre: 'B', zonaHoraria: 'UTC' },
          { _id: c, alias: 'alfa', nombre: 'A', zonaHoraria: 'UTC' },
        ]),
    };
    const desafios = {
      findById: () =>
        Promise.resolve({
          _id: desafioId,
          participantes: [a, b, c],
          cancelado: false,
          fechaInicio: new Date('2026-10-01'),
          fechaFin: new Date('2026-10-29'),
        }),
    };
    const registros = [
      { persona: a, fecha: '2026-10-29', puntos: 20 },
      { persona: b, fecha: '2026-10-28', puntos: 10 },
      { persona: b, fecha: '2026-10-29', puntos: 10 },
      { persona: c, fecha: '2026-10-28', puntos: 10 },
      { persona: c, fecha: '2026-10-29', puntos: 10 },
    ];
    const checkins = { find: () => Promise.resolve(registros) };
    const service = new ProgresoService(
      personas as unknown as Model<Persona>,
      desafios as unknown as Model<Desafio>,
      checkins as unknown as Model<Checkin>,
    );
    const ranking = await service.ranking(desafioId.toString());
    expect(ranking.items.map((p) => p.alias)).toEqual(['alfa', 'beta', 'zeta']);
    expect(ranking.ganador?.personaId).toBe(c.toString());
    expect(ranking.items.map((p) => p.posicion)).toEqual([1, 2, 3]);
  });
});
