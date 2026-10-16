export type Categoria = 'SALUD' | 'ESTUDIO' | 'FINANZAS' | 'BIENESTAR' | 'OTRO';

export interface Persona {
  id: string;
  nombre: string;
  alias: string;
  email: string;
  zonaHoraria: string;
}

export interface CrearPersona {
  nombre: string;
  alias: string;
  email: string;
  zonaHoraria?: string;
}

export interface Desafio {
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
  id: string;
  persona: string;
  desafio: string;
  fecha: string; // YYYY-MM-DD
  nota?: string;
  valor?: number;
}

export interface CrearCheckin {
  fecha: string;
  nota?: string;
  valor?: number;
}
