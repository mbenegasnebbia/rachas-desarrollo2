import type { Aliento } from "./realtime.types";

// El login nativo todavía no está implementado. No abrir sockets sin Firebase.
export function useDesafioRealtime(
  _desafioId: string,
  _personaId: string | undefined,
  _habilitado: boolean,
  _refrescar: () => Promise<void>,
) {
  return {
    estado: "Tiempo real disponible en Expo Web",
    error: "",
    alientos: [] as Aliento[],
    enviando: false,
    enEspera: false,
    aviso: "",
    enviar: (_emoji: string) => {},
    reconectar: () => {},
  };
}
