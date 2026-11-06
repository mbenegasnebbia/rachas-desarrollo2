import { jest } from '@jest/globals';
import { Types, Model } from 'mongoose';
import type { AuthService } from '../auth/auth.service';
import type { FirebasePersonaService } from '../auth/firebase-persona.service';
import type { Desafio } from '../desafios/schemas/desafio.schema';
import type { SocketAccessService, SocketState } from './socket-access.service';
import { AlientoLimiter } from './aliento-limiter.service';

jest.unstable_mockModule('firebase-admin/auth', () => ({ getAuth: jest.fn() }));
let Service: typeof import('./socket-access.service').SocketAccessService;
beforeAll(async () => {
  const modulePath = './socket-access.service';
  Service = (
    (await import(modulePath)) as typeof import('./socket-access.service')
  ).SocketAccessService;
});

describe('Autenticación y salas, sin Atlas', () => {
  const personaId = new Types.ObjectId().toString();
  const otherId = new Types.ObjectId();
  const desafioId = new Types.ObjectId().toString();
  const verifySocketToken = jest.fn<AuthService['verifySocketToken']>();
  const findExisting = jest.fn<FirebasePersonaService['findExisting']>();
  const resolve = jest.fn();
  const findById = jest.fn<(...args: unknown[]) => Promise<unknown>>();
  let service: SocketAccessService;
  let state: SocketState;
  let challenge: {
    participantes: Types.ObjectId[];
    fechaInicio: Date;
    fechaFin: Date;
    cancelado: boolean;
  };

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-06T15:00:00Z'));
    state = {
      uid: 'uid-real',
      personaId,
      expiresAt: Date.now() + 3600000,
      desafioId,
    };
    challenge = {
      participantes: [new Types.ObjectId(personaId), otherId],
      fechaInicio: new Date('2026-11-05'),
      fechaFin: new Date('2026-11-10'),
      cancelado: false,
    };
    verifySocketToken.mockReset().mockResolvedValue({
      identity: {
        uid: state.uid,
        name: 'Persona real',
        email: null,
        emailVerified: true,
        provider: 'google.com',
      },
      expiresAt: state.expiresAt,
    });
    findExisting.mockReset().mockResolvedValue({
      _id: new Types.ObjectId(personaId),
      nombre: 'Persona real',
      perfilCompleto: true,
    } as Awaited<ReturnType<FirebasePersonaService['findExisting']>>);
    resolve.mockReset();
    findById.mockReset().mockImplementation(() => Promise.resolve(challenge));
    service = new Service(
      { verifySocketToken } as unknown as AuthService,
      { findExisting, resolve } as unknown as FirebasePersonaService,
      { findById } as unknown as Model<Desafio>,
      new AlientoLimiter(),
    );
  });
  afterEach(() => jest.useRealTimers());

  it.each([undefined, {}, { token: '' }, { personaId: 'arbitraria' }])(
    'rechaza credenciales ausentes: %p',
    async (payload) => {
      await expect(service.authenticate(payload)).rejects.toMatchObject({
        code: 'AUTH_REQUIRED',
      });
      expect(verifySocketToken).not.toHaveBeenCalled();
    },
  );
  it('usa UID verificado, ignora personaId del cliente y no crea perfiles', async () => {
    const result = await service.authenticate({
      token: 'simulado',
      personaId: 'ajena',
    });
    expect(result.personaId).toBe(personaId);
    expect(result).not.toHaveProperty('token');
    expect(findExisting).toHaveBeenCalledWith('uid-real');
    expect(resolve).not.toHaveBeenCalled();
  });
  it('rechaza tokens inválidos sin filtrar su excepción', async () => {
    verifySocketToken.mockRejectedValue(new Error('credencial-simulada'));
    await expect(
      service.authenticate({ token: 'simulado' }),
    ).rejects.toMatchObject({
      code: 'AUTH_REQUIRED',
      message: 'La sesión del socket no es válida',
    });
  });
  it('rechaza perfiles ausentes/incompletos', async () => {
    findExisting.mockResolvedValue(null);
    await expect(
      service.authenticate({ token: 'simulado' }),
    ).rejects.toMatchObject({ code: 'PROFILE_REQUIRED' });
  });
  it('autoriza solo miembros actuales', async () => {
    await expect(service.authorize(desafioId, state)).resolves.toBe(challenge);
    challenge.participantes = [otherId];
    await expect(service.authorize(desafioId, state)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
  it.each(['cancelado', 'finalizado'])(
    'rechaza salas de desafío %s',
    async (kind) => {
      if (kind === 'cancelado') challenge.cancelado = true;
      else challenge.fechaFin = new Date('2026-11-05');
      await expect(service.authorize(desafioId, state)).rejects.toMatchObject({
        code: 'STATE_CLOSED',
      });
    },
  );
  it('rechaza IDs inválidos antes de consultar MongoDB', async () => {
    await expect(service.authorize('invalido', state)).rejects.toMatchObject({
      code: 'INVALID_PAYLOAD',
    });
    expect(findById).not.toHaveBeenCalled();
  });
  it('rechaza mensajes con sesión vencida', async () => {
    state.expiresAt = Date.now();
    await expect(service.authorize(desafioId, state)).rejects.toMatchObject({
      code: 'AUTH_REQUIRED',
    });
  });
  it('usa nombre real y limita entre pestañas de la misma persona', async () => {
    expect(
      await service.cheer({ desafioId, emoji: '👏' }, state),
    ).toMatchObject({
      personaId,
      nombre: 'Persona real',
      emoji: '👏',
      desafioId,
    });
    await expect(
      service.cheer({ desafioId, emoji: '🔥' }, { ...state }),
    ).rejects.toMatchObject({ code: 'RATE_LIMIT' });
    jest.advanceTimersByTime(10000);
    await expect(
      service.cheer({ desafioId, emoji: '🔥' }, state),
    ).resolves.toHaveProperty('emoji', '🔥');
  });
  it('permite sala programada pero no alientos', async () => {
    challenge.fechaInicio = new Date('2026-11-07');
    await expect(service.authorize(desafioId, state)).resolves.toBe(challenge);
    await expect(
      service.cheer({ desafioId, emoji: '👏' }, state),
    ).rejects.toMatchObject({ code: 'STATE_CLOSED' });
  });
  it('requiere suscripción y otro participante', async () => {
    await expect(
      service.cheer(
        { desafioId, emoji: '👏' },
        { ...state, desafioId: undefined },
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    challenge.participantes = [new Types.ObjectId(personaId)];
    await expect(
      service.cheer({ desafioId, emoji: '👏' }, state),
    ).rejects.toMatchObject({ code: 'NO_RECIPIENTS' });
  });
});
