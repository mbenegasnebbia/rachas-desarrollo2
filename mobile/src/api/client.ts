// En Expo Go el celular no puede usar "localhost": definir EXPO_PUBLIC_API_URL
// con la IP de la PC en la red local (ver mobile/.env.example).
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

interface Opciones {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  usuarioId?: string;
}

export async function request<T>(
  path: string,
  { method = 'GET', body, usuarioId }: Opciones = {},
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (usuarioId) headers['x-usuario-id'] = usuarioId;

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const texto = await res.text();
  const data = texto ? JSON.parse(texto) : undefined;

  if (!res.ok) {
    // NestJS devuelve { message: string | string[] }
    const msg = Array.isArray(data?.message)
      ? data.message.join('\n')
      : (data?.message ?? 'Error de red');
    throw new ApiError(res.status, msg);
  }
  return data as T;
}
