export const EMOJIS = ['👏', '💪', '🔥', '🙌', '🎉', '❤️'] as const;

export class SocketAccessError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly retryAfterMs?: number,
  ) {
    super(message);
  }
}
export type Ack =
  | { ok: true }
  | {
      ok: false;
      code: string;
      message: string;
      retryAfterMs?: number;
    };

export function socketFailure(error: unknown): Ack {
  if (error instanceof SocketAccessError)
    return {
      ok: false,
      code: error.code,
      message: error.message,
      ...(error.retryAfterMs !== undefined
        ? { retryAfterMs: error.retryAfterMs }
        : {}),
    };
  return {
    ok: false,
    code: 'UNAVAILABLE',
    message: 'No se pudo validar la operación. Reintentá.',
  };
}

export function challengePayload(
  body: unknown,
  withEmoji = false,
): { desafioId: string; emoji?: string } {
  if (
    typeof body !== 'object' ||
    body === null ||
    !('desafioId' in body) ||
    typeof body.desafioId !== 'string' ||
    Object.keys(body).some(
      (key) => !['desafioId', ...(withEmoji ? ['emoji'] : [])].includes(key),
    )
  )
    throw new SocketAccessError(
      'INVALID_PAYLOAD',
      'Datos de desafío inválidos',
    );
  if (
    withEmoji &&
    (!('emoji' in body) ||
      typeof body.emoji !== 'string' ||
      !EMOJIS.some((emoji) => emoji === body.emoji))
  )
    throw new SocketAccessError(
      'INVALID_EMOJI',
      'Elegí uno de los emojis permitidos',
    );
  return {
    desafioId: body.desafioId.toLowerCase(),
    ...(withEmoji && 'emoji' in body ? { emoji: body.emoji as string } : {}),
  };
}

export function allowedSocketOrigin(origin: string | undefined): boolean {
  const origins = (
    process.env.SOCKET_ALLOWED_ORIGINS ||
    'http://localhost:8081,http://localhost:8082,http://localhost:8080'
  )
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return origin === undefined || origins.includes(origin);
}
