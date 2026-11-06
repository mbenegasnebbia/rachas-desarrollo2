import { jest } from '@jest/globals';
import type { Namespace } from 'socket.io';
import type { RealtimeGateway, RealtimeSocket } from './realtime.gateway';
import type { SocketAccessService, SocketState } from './socket-access.service';
import { RealtimeEventsService } from './realtime-events.service';
import { SocketAccessError } from './socket-policy';

jest.unstable_mockModule('./socket-access.service', () => ({
  SocketAccessService: class {},
}));
let Gateway: typeof import('./realtime.gateway').RealtimeGateway;
beforeAll(async () => {
  const modulePath = './realtime.gateway';
  Gateway = ((await import(modulePath)) as typeof import('./realtime.gateway'))
    .RealtimeGateway;
});

describe('Gateway con clientes simulados', () => {
  const id = '0123456789abcdef01234567';
  const authenticate = jest.fn<SocketAccessService['authenticate']>();
  const authorize = jest.fn<SocketAccessService['authorize']>();
  const challenge = jest.fn<SocketAccessService['challenge']>();
  const cheer = jest.fn<SocketAccessService['cheer']>();
  const assertLive = jest.fn<SocketAccessService['assertLive']>();
  const use = jest.fn();
  let gateway: RealtimeGateway;
  let events: RealtimeEventsService;
  let current: Awaited<ReturnType<SocketAccessService['challenge']>>;

  const mocks = new WeakMap<
    RealtimeSocket,
    {
      emit: ReturnType<typeof jest.fn>;
      disconnect: ReturnType<typeof jest.fn>;
      join: ReturnType<typeof jest.fn>;
      leave: ReturnType<typeof jest.fn>;
    }
  >();
  function client(personaId: string) {
    const data: SocketState = {
      uid: 'uid-' + personaId,
      personaId,
      expiresAt: Date.now() + 60000,
    };
    const methods = {
      join: jest.fn<() => Promise<void>>().mockResolvedValue(),
      leave: jest.fn<() => Promise<void>>().mockResolvedValue(),
      emit: jest.fn(),
      disconnect: jest.fn(),
    };
    const socket = {
      id: 'socket-' + personaId,
      data,
      connected: true,
      handshake: { auth: { token: 'simulado' } },
      ...methods,
    } as unknown as RealtimeSocket;
    mocks.set(socket, methods);
    return socket;
  }
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-06T15:00:00Z'));
    events = new RealtimeEventsService();
    current = {
      participantes: [{ toString: () => 'a' }, { toString: () => 'b' }],
      fechaInicio: new Date('2026-11-05'),
      fechaFin: new Date('2026-11-10'),
      cancelado: false,
    } as unknown as Awaited<ReturnType<SocketAccessService['challenge']>>;
    authenticate.mockReset();
    authenticate.mockResolvedValue({
      uid: 'uid-a',
      personaId: 'a',
      expiresAt: Date.now() + 60000,
    });
    authorize.mockReset().mockResolvedValue(current);
    challenge.mockReset().mockImplementation(() => Promise.resolve(current));
    cheer.mockReset().mockResolvedValue({
      id: 'evento',
      desafioId: id,
      emoji: '👏',
      personaId: 'a',
      nombre: 'A',
      fecha: new Date().toISOString(),
    });
    assertLive.mockReset();
    use.mockReset();
    gateway = new Gateway(
      {
        authenticate,
        authorize,
        challenge,
        cheer,
        assertLive,
      } as unknown as SocketAccessService,
      events,
    );
    gateway.afterInit({ use } as unknown as Namespace);
  });
  afterEach(() => {
    gateway.onModuleDestroy();
    jest.useRealTimers();
  });

  it('rechaza el handshake antes de conectar y descarta credenciales', async () => {
    authenticate.mockRejectedValue(
      new SocketAccessError('AUTH_REQUIRED', 'rechazado'),
    );
    const socket = client('a');
    const middleware = use.mock.calls[0][0] as (
      s: RealtimeSocket,
      next: (e?: Error) => void,
    ) => void;
    await new Promise<void>((resolve) =>
      middleware(socket, (error) => {
        expect(error?.message).toBe('Autenticación del socket rechazada');
        expect(socket.handshake.auth).toEqual({});
        resolve();
      }),
    );
  });
  it('no une una sala rechazada', async () => {
    const socket = client('a');
    authorize.mockRejectedValue(
      new SocketAccessError('FORBIDDEN', 'rechazado'),
    );
    await expect(
      gateway.subscribe(socket, { desafioId: id }),
    ).resolves.toMatchObject({ ok: false, code: 'FORBIDDEN' });
    expect(mocks.get(socket)?.join).not.toHaveBeenCalled();
  });
  it('sale de la sala anterior al cambiar desafío', async () => {
    const socket = client('a');
    gateway.handleConnection(socket);
    await gateway.subscribe(socket, { desafioId: id });
    await gateway.subscribe(socket, { desafioId: 'abcdef0123456789abcdef01' });
    expect(mocks.get(socket)?.leave).toHaveBeenCalledWith('desafio:' + id);
  });
  it('revoca al que abandona antes de notificar al resto', async () => {
    const a = client('a'),
      b = client('b');
    gateway.handleConnection(a);
    gateway.handleConnection(b);
    await gateway.subscribe(a, { desafioId: id });
    await gateway.subscribe(b, { desafioId: id });
    current.participantes = current.participantes.filter(
      (p) => p.toString() === 'a',
    );
    events.publish(id, 'participante:abandono', 'b');
    expect(b.data.desafioId).toBeUndefined();
    await Promise.resolve();
    await Promise.resolve();
    expect(mocks.get(a)?.emit).toHaveBeenCalledWith('participante:abandono', {
      desafioId: id,
    });
    expect(mocks.get(b)?.emit).not.toHaveBeenCalledWith(
      'participante:abandono',
      {
        desafioId: id,
      },
    );
  });
  it('no entrega alientos al emisor ni a miembros expulsados', async () => {
    const a = client('a'),
      b = client('b'),
      removed = client('fuera');
    for (const socket of [a, b, removed]) {
      gateway.handleConnection(socket);
      await gateway.subscribe(socket, { desafioId: id });
    }
    await gateway.cheer(a, { desafioId: id, emoji: '👏' });
    expect(mocks.get(b)?.emit).toHaveBeenCalledWith(
      'aliento:recibido',
      expect.objectContaining({ nombre: 'A' }),
    );
    expect(mocks.get(a)?.emit).not.toHaveBeenCalledWith(
      'aliento:recibido',
      expect.anything(),
    );
    expect(mocks.get(removed)?.emit).not.toHaveBeenCalledWith(
      'aliento:recibido',
      expect.anything(),
    );
    expect(removed.data.desafioId).toBeUndefined();
  });
  it('notifica cancelación y cierra las salas', async () => {
    const a = client('a');
    gateway.handleConnection(a);
    await gateway.subscribe(a, { desafioId: id });
    current.cancelado = true;
    events.publish(id, 'desafio:cancelado', 'a');
    await Promise.resolve();
    await Promise.resolve();
    expect(mocks.get(a)?.emit).toHaveBeenCalledWith('desafio:cancelado', {
      desafioId: id,
    });
    expect(a.data.desafioId).toBeUndefined();
  });
  it('desconecta al vencer el token', () => {
    const a = client('a');
    a.data.expiresAt = Date.now() + 1000;
    gateway.handleConnection(a);
    jest.advanceTimersByTime(1000);
    expect(mocks.get(a)?.emit).toHaveBeenCalledWith('sesion:expirada');
    expect(mocks.get(a)?.disconnect).toHaveBeenCalledWith(true);
  });

  it('asigna solo la identidad verificada al aceptar la conexión', async () => {
    const socket = client('ajena');
    const middleware = use.mock.calls[0][0] as (
      s: RealtimeSocket,
      next: (e?: Error) => void,
    ) => void;
    await new Promise<void>((resolve) =>
      middleware(socket, (error) => {
        expect(error).toBeUndefined();
        expect(socket.data.personaId).toBe('a');
        expect(socket.data).not.toHaveProperty('token');
        resolve();
      }),
    );
  });

  it('serializa suscripciones y cancela una pendiente cuando se sale del desafío', async () => {
    const socket = client('a');
    let release: () => void = () => {};
    authorize.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = () => resolve(current);
        }),
    );
    const pending = gateway.subscribe(socket, { desafioId: id });
    await expect(
      gateway.subscribe(socket, { desafioId: id }),
    ).resolves.toMatchObject({ ok: false, code: 'BUSY' });
    gateway.leaveChallenge(socket, { desafioId: id });
    release();
    await expect(pending).resolves.toMatchObject({
      ok: false,
      code: 'FORBIDDEN',
    });
    expect(mocks.get(socket)?.join).not.toHaveBeenCalled();
  });

  it('no entrega alientos a un receptor cuyo token ya venció', async () => {
    const a = client('a'),
      b = client('b');
    gateway.handleConnection(a);
    gateway.handleConnection(b);
    await gateway.subscribe(a, { desafioId: id });
    await gateway.subscribe(b, { desafioId: id });
    b.data.expiresAt = Date.now();
    await gateway.cheer(a, { desafioId: id, emoji: '👏' });
    expect(mocks.get(b)?.emit).not.toHaveBeenCalledWith(
      'aliento:recibido',
      expect.anything(),
    );
    expect(b.data.desafioId).toBeUndefined();
  });
});
