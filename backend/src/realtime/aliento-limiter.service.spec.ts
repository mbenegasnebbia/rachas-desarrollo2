import { AlientoLimiter } from './aliento-limiter.service';
import {
  SocketAccessError,
  challengePayload,
  allowedSocketOrigin,
} from './socket-policy';

describe('Límite de alientos', () => {
  it('reserva 10 segundos por persona y desafío, sin reset al reconectar', () => {
    const limiter = new AlientoLimiter();
    limiter.reserve('a', 'x', 0);
    expect(() => limiter.reserve('a', 'x', 9999)).toThrow(SocketAccessError);
    expect(() => limiter.reserve('a', 'x', 10000)).not.toThrow();
  });
  it('informa tiempo restante y permite otros pares persona/desafío', () => {
    const limiter = new AlientoLimiter();
    limiter.reserve('a', 'x', 1000);
    try {
      limiter.reserve('a', 'x', 3000);
      throw new Error('Debió rechazar');
    } catch (error) {
      expect(error).toMatchObject({ code: 'RATE_LIMIT', retryAfterMs: 8000 });
    }
    expect(() => limiter.reserve('b', 'x', 3000)).not.toThrow();
    expect(() => limiter.reserve('a', 'y', 3000)).not.toThrow();
  });
  it.each([
    { desafioId: 'id', emoji: 'texto' },
    { desafioId: 'id', emoji: '👏', personaId: 'ajena' },
    { desafioId: 'id', emoji: '👏', nombre: 'impostor' },
  ])('rechaza contenido o identidad arbitrarios: %p', (body) => {
    expect(() => challengePayload(body, true)).toThrow(SocketAccessError);
  });

  it('aplica la lista explícita de orígenes del handshake', () => {
    const previous = process.env.SOCKET_ALLOWED_ORIGINS;
    process.env.SOCKET_ALLOWED_ORIGINS = 'http://localhost:8081';
    try {
      expect(allowedSocketOrigin('http://localhost:8081')).toBe(true);
      expect(allowedSocketOrigin('https://otro.example')).toBe(false);
      expect(allowedSocketOrigin(undefined)).toBe(true);
    } finally {
      if (previous === undefined) delete process.env.SOCKET_ALLOWED_ORIGINS;
      else process.env.SOCKET_ALLOWED_ORIGINS = previous;
    }
  });

  it('no permite eludir el límite variando mayúsculas del mismo ObjectId', () => {
    const limiter = new AlientoLimiter();
    limiter.reserve('persona', 'ABCDEF0123456789ABCDEF01', 0);
    expect(() =>
      limiter.reserve('persona', 'abcdef0123456789abcdef01', 1),
    ).toThrow(SocketAccessError);
    expect(
      challengePayload({ desafioId: 'ABCDEF0123456789ABCDEF01' }).desafioId,
    ).toBe('abcdef0123456789abcdef01');
  });
});
