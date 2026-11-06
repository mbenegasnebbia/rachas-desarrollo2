// Google nativo queda fuera del alcance Web. No hay ingreso provisional alternativo.
export interface UsuarioFirebase {
  uid: string;
}
export function observarSesion(
  cambiar: (user: UsuarioFirebase | null) => void,
  _error: (e: unknown) => void,
): () => void {
  cambiar(null);
  return () => {};
}
export function ingresarConGoogle(): Promise<void> {
  return Promise.reject(
    new Error(
      "El ingreso con Google está disponible en Expo Web. Android requiere una integración nativa posterior.",
    ),
  );
}
export function obtenerToken(_force = false): Promise<string | null> {
  return Promise.resolve(null);
}
export function cerrarSesionFirebase(): Promise<void> {
  return Promise.resolve();
}
export function mensajeErrorAuth(_error: unknown): string {
  return "No se pudo iniciar sesión. Usá Expo Web para ingresar con Google.";
}
