export const API_URL = process.env.EXPO_PUBLIC_API_URL;
let sesionId: string | undefined;
export function identificar(id?: string) {
  sesionId = id;
}
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
interface Opciones {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  usuarioId?: string;
}
export async function request<T>(
  path: string,
  { method = "GET", body, usuarioId = sesionId }: Opciones = {},
): Promise<T> {
  if (!API_URL)
    throw new ApiError(
      0,
      "Falta configurar EXPO_PUBLIC_API_URL en mobile/.env.local.",
    );
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(API_URL.replace(/\/$/, "") + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(usuarioId ? { "x-usuario-id": usuarioId } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    const texto = await res.text();
    let data: unknown;
    try {
      data = texto ? JSON.parse(texto) : undefined;
    } catch {
      throw new ApiError(
        res.status,
        "El servidor devolvió una respuesta inesperada.",
      );
    }
    if (!res.ok) {
      const mensaje =
        typeof data === "object" && data !== null && "message" in data
          ? data.message
          : undefined;
      throw new ApiError(
        res.status,
        Array.isArray(mensaje)
          ? mensaje.join("\n")
          : typeof mensaje === "string"
            ? mensaje
            : "No se pudo completar la operación.",
      );
    }
    return data as T;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(
      0,
      controller.signal.aborted
        ? "El servidor tardó demasiado. Volvé a intentar."
        : "No pudimos conectar con el servidor. Revisá tu conexión e intentá de nuevo.",
    );
  } finally {
    clearTimeout(timeout);
  }
}
