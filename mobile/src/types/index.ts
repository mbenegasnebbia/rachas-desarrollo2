export type Categoria = "SALUD" | "ESTUDIO" | "FINANZAS" | "BIENESTAR" | "OTRO";

export interface Persona {
  id: string;
  nombre: string;
  alias: string;
  email: string;
  zonaHoraria: string;
  perfilCompleto: boolean;
}

export interface CrearPersona {
  nombre: string;
  alias: string;
  email: string;
  zonaHoraria?: string;
}

export interface Desafio {
  estado?: string;
  id: string;
  nombre: string;
  descripcion?: string;
  categoria: Categoria;
  fechaInicio: string;
  fechaFin: string;
  maxParticipantes: number;
  codigoInvitacion: string;
  creador: string;
  participantes: string[];
  exParticipantes: string[];
  cancelado: boolean;
}

export interface CrearDesafio {
  nombre: string;
  descripcion?: string;
  categoria: Categoria;
  fechaInicio: string;
  fechaFin: string;
  maxParticipantes?: number;
}

export interface Checkin {
  puntos: number;
  id: string;
  persona: string;
  desafio: string;
  fecha: string; // YYYY-MM-DD
  nota?: string;
  valor?: number;
}

export interface CrearCheckin {
  zonaHoraria: string;
  fecha: string;
  nota?: string;
  valor?: number;
}

export type Estado = "PROGRAMADO" | "ACTIVO" | "FINALIZADO" | "CANCELADO" | "PAUSADO" | "DESCONOCIDO";
export interface Pagina<T> {
  items: T[];
  total: number;
  pagina: number;
  limite: number;
  paginas: number;
}
export interface Posicion {
  personaId: string;
  alias: string;
  nombre: string;
  puntos: number;
  rachaActual: number;
  mejorRacha: number;
  checkinHoy: boolean;
  posicion: number;
}
export interface Ranking {
  items: Posicion[];
  ganador: Posicion | null;
}
export interface Resumen extends Posicion {
  desafio: Desafio;
  estado: Estado;
}
export interface Resultado {
  desafio: Desafio;
  resultado: Posicion;
  ganador: Posicion | null;
}
