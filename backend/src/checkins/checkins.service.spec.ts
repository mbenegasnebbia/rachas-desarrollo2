import { jest } from '@jest/globals';
import { Model, Types } from 'mongoose';
import { CheckinsService } from './checkins.service';
import { Checkin } from './schemas/checkin.schema';
import { Persona } from '../personas/schemas/persona.schema';
import { Desafio } from '../desafios/schemas/desafio.schema';
const personaId = new Types.ObjectId(),
  desafioId = new Types.ObjectId();
describe('Registrar y deshacer check-ins', () => {
  afterEach(() => jest.useRealTimers());
  function preparar(
    fechas: string[] = [],
    opciones: { participa?: boolean; cancelado?: boolean } = {},
  ) {
    const persona = { _id: personaId, zonaHoraria: 'UTC' };
    const desafio = {
      _id: desafioId,
      participantes: opciones.participa === false ? [] : [personaId],
      cancelado: opciones.cancelado ?? false,
      fechaInicio: new Date('2026-10-01'),
      fechaFin: new Date('2026-11-01'),
    };
    const guardar = jest.fn<(datos: unknown) => Promise<unknown>>((d) =>
      Promise.resolve(d),
    );
    class CheckinFalso {
      constructor(private datos: unknown) {}
      save() {
        return guardar(this.datos);
      }
      static find() {
        return Promise.resolve(fechas.map((fecha) => ({ fecha, puntos: 10 })));
      }
      static findOne() {
        return Promise.resolve(null);
      }
    }
    const service = new CheckinsService(
      CheckinFalso as unknown as Model<Checkin>,
      { findById: () => Promise.resolve(desafio) } as unknown as Model<Desafio>,
      { findById: () => Promise.resolve(persona) } as unknown as Model<Persona>,
    );
    return { service, guardar };
  }
  it('guarda bonus al completar la tercera fecha consecutiva', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-30T15:00:00Z'));
    const { service, guardar } = preparar(['2026-10-28', '2026-10-29']);
    await service.create(desafioId.toString(), personaId.toString(), {
      fecha: '2026-10-30',
    });
    expect(guardar).toHaveBeenCalledWith(
      expect.objectContaining({ puntos: 15 }),
    );
  });
  it('no extiende la racha a través de un hueco de un día', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-30T15:00:00Z'));
    const { service, guardar } = preparar(['2026-10-27', '2026-10-28']);
    await service.create(desafioId.toString(), personaId.toString(), {
      fecha: '2026-10-30',
    });
    expect(guardar).toHaveBeenCalledWith(
      expect.objectContaining({ puntos: 10 }),
    );
  });
  it('rechaza deshacer si ya no participa o el desafío está cancelado', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-30T15:00:00Z'));
    await expect(
      preparar([], { participa: false }).service.undo(
        desafioId.toString(),
        personaId.toString(),
      ),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      preparar([], { cancelado: true }).service.undo(
        desafioId.toString(),
        personaId.toString(),
      ),
    ).rejects.toMatchObject({ status: 409 });
  });
});
