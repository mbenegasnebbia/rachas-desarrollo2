export const EMOJIS = ["👏", "💪", "🔥", "🙌", "🎉", "❤️"] as const;
export const CHANGE_EVENTS = [
  "checkin:registrado",
  "checkin:deshecho",
  "participante:unido",
  "participante:abandono",
  "desafio:cancelado",
] as const;
export interface Change {
  desafioId: string;
}
export interface Aliento {
  id: string;
  desafioId: string;
  emoji: string;
  personaId: string;
  nombre: string;
  fecha: string;
}
export type Ack =
  | { ok: true }
  | {
      ok: false;
      code: string;
      message: string;
      retryAfterMs?: number;
    };
export interface ServerEvents {
  "checkin:registrado": (event: Change) => void;
  "checkin:deshecho": (event: Change) => void;
  "participante:unido": (event: Change) => void;
  "participante:abandono": (event: Change) => void;
  "desafio:cancelado": (event: Change) => void;
  "aliento:recibido": (event: Aliento) => void;
  "sala:revocada": (event: { desafioId: string; message: string }) => void;
  "sesion:expirada": () => void;
}
export interface ClientEvents {
  "desafio:suscribir": (body: Change, ack: (result: Ack) => void) => void;
  "desafio:salir": (body: Change, ack: (result: Ack) => void) => void;
  "aliento:enviar": (
    body: Change & { emoji: string },
    ack: (result: Ack) => void,
  ) => void;
}
