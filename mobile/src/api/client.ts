// La URL del back se define en mobile/.env.local (ver mobile/.env.example).
// Emulador Android: http://10.0.2.2:3000 | Celular físico: IP de la PC en la red.
export const API_URL = process.env.EXPO_PUBLIC_API_URL;

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

  if (!API_URL) {
    throw new ApiError(0, 'Falta definir EXPO_PUBLIC_API_URL en mobile/.env.local');
  }

let res: Response;

const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 5000);

try {
  res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: controller.signal,
  });
} catch {
  if (controller.signal.aborted) {
    throw new ApiError(0, 'El servidor no respondió a tiempo.');
  }

  throw new ApiError(0, `No se pudo conectar con el servidor (${API_URL})`);
} finally {
  clearTimeout(timeout);
}

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
