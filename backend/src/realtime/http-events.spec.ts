import type { SolicitudesAccesoService } from '../desafios/solicitudesAcceso.service';
import { jest } from '@jest/globals';
import { Types } from 'mongoose';
import { CheckinsController } from '../checkins/checkins.controller';
import { DesafiosController } from '../desafios/desafios.controller';
import type { CheckinsService } from '../checkins/checkins.service';
import type { DesafiosService } from '../desafios/desafios.service';
import { RealtimeEventsService } from './realtime-events.service';

describe('Publicación después de operaciones HTTP exitosas', () => {
  const id = new Types.ObjectId();
  const publish = jest.fn<RealtimeEventsService['publish']>();
  const operation = jest.fn<(...args: unknown[]) => Promise<unknown>>();
  const bus = { publish } as unknown as RealtimeEventsService;
  const checkins = new CheckinsController(
    { create: operation, undo: operation } as unknown as CheckinsService,
    bus,
  );
  const desafios = new DesafiosController(
    {
      join: operation,
      leave: operation,
      cancel: operation,
    } as unknown as DesafiosService,
    bus,
    { solicitar: operation } as unknown as SolicitudesAccesoService,
  );
  beforeEach(() => {
    publish.mockReset();
    operation.mockReset().mockResolvedValue({ _id: id });
  });
  it.each([
    [
      'checkin:registrado',
      () => checkins.create(id.toString(), 'persona', { fecha: '2026-11-06' }),
    ],
    ['checkin:deshecho', () => checkins.undo(id.toString(), 'persona')],
    ['participante:abandono', () => desafios.leave(id.toString(), 'persona')],
    ['desafio:cancelado', () => desafios.cancel(id.toString(), 'persona')],
  ] as const)('emite %s tras persistir', async (event, execute) => {
    await execute();
    expect(publish).toHaveBeenCalledWith(id.toString(), event, 'persona');
  });
  it('solicitar por codigo no emite una incorporacion', () => {
    expect(() => desafios.join()).toThrow();
    expect(publish).not.toHaveBeenCalled();
  });
  it('no emite si el servicio rechaza la operación', async () => {
    operation.mockRejectedValue(new Error('rechazado'));
    await expect(checkins.undo(id.toString(), 'persona')).rejects.toThrow(
      'rechazado',
    );
    expect(publish).not.toHaveBeenCalled();
  });
});
