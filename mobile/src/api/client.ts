import { obtenerToken } from "@/auth/session";

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
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
}
export async function request<T>(
  path: string,
  { method = "GET", body }: Opciones = {},
): Promise<T> {
  if (!API_URL) throw new ApiError(0, "Falta configurar EXPO_PUBLIC_API_URL.");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    for (let intento = 0; intento < 2; intento++) {
      let token: string | null;
      try {
        token = await obtenerToken(intento === 1);
      } catch {
        throw new ApiError(
          401,
          "Tu sesión venció. Volvé a ingresar con Google.",
        );
      }
      if (!token) throw new ApiError(401, "Ingresá con Google para continuar.");
      const res = await fetch(API_URL.replace(/\/$/, "") + path, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
        credentials: "omit",
        cache: "no-store",
        redirect: "error",
      });
      // El guard rechaza antes del controlador: reintentar una sola vez es seguro.
      if (res.status === 401 && intento === 0) continue;
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
          res.status === 401
            ? "Tu sesión no es válida. Cerrá sesión y volvé a ingresar."
            : Array.isArray(mensaje)
              ? mensaje.join("\n")
              : typeof mensaje === "string"
                ? mensaje
                : "No se pudo completar la operación.",
        );
      }
      return data as T;
    }
    throw new ApiError(401, "No se pudo renovar la sesión.");
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
