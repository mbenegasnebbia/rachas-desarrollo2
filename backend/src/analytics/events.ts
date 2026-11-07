import { BadRequestException } from '@nestjs/common';
export const EVENT_NAMES = [
  'ingreso_exitoso',
  'desafio_creado',
  'desafio_unido',
  'checkin_hecho',
  'ranking_consultado',
  'racha_perdida',
  'aviso_actualizacion_mostrado',
] as const;
export type EventName = (typeof EVENT_NAMES)[number];
export interface UsageEvent {
  eventId: string;
  name: EventName;
  occurredAt: string;
  appVersion: string;
  platform: 'web' | 'android' | 'ios';
  properties: Record<string, string | number>;
}
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const exact = (value: Record<string, unknown>, keys: string[]) =>
  Object.keys(value).length === keys.length &&
  keys.every((k) => Object.hasOwn(value, k));
const version = (v: unknown) =>
  typeof v === 'string' &&
  v.length <= 20 &&
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(v);
export function validateEvent(value: unknown, now = Date.now()): UsageEvent {
  const invalid = () => {
    throw new BadRequestException('Evento de analytics inválido');
  };
  if (
    !record(value) ||
    !exact(value, [
      'eventId',
      'name',
      'occurredAt',
      'appVersion',
      'platform',
      'properties',
    ])
  )
    return invalid();
  if (
    typeof value.eventId !== 'string' ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(
      value.eventId,
    ) ||
    !EVENT_NAMES.includes(value.name as EventName) ||
    !version(value.appVersion) ||
    !['web', 'android', 'ios'].includes(value.platform as string) ||
    typeof value.occurredAt !== 'string' ||
    !record(value.properties)
  )
    return invalid();
  const time = Date.parse(value.occurredAt);
  if (
    !Number.isFinite(time) ||
    time < now - 7 * 86400000 ||
    time > now + 300000 ||
    new Date(time).toISOString() !== value.occurredAt
  )
    return invalid();
  const p = value.properties;
  const id =
    typeof p.desafio_id === 'string' && /^[a-f0-9]{24}$/i.test(p.desafio_id);
  switch (value.name) {
    case 'ingreso_exitoso':
      if (!exact(p, [])) return invalid();
      break;
    case 'desafio_creado':
      if (
        !exact(p, ['desafio_id', 'categoria']) ||
        !id ||
        !['SALUD', 'ESTUDIO', 'FINANZAS', 'BIENESTAR', 'OTRO'].includes(
          p.categoria as string,
        )
      )
        return invalid();
      break;
    case 'desafio_unido':
    case 'checkin_hecho':
    case 'ranking_consultado':
      if (!exact(p, ['desafio_id']) || !id) return invalid();
      break;
    case 'racha_perdida':
      if (
        !exact(p, ['desafio_id', 'racha_anterior']) ||
        !id ||
        !Number.isInteger(p.racha_anterior) ||
        Number(p.racha_anterior) < 1 ||
        Number(p.racha_anterior) > 90
      )
        return invalid();
      break;
    case 'aviso_actualizacion_mostrado':
      if (
        !exact(p, ['tipo', 'version_objetivo']) ||
        !['recomendada', 'obligatoria'].includes(p.tipo as string) ||
        !version(p.version_objetivo)
      )
        return invalid();
  }
  return value as unknown as UsageEvent;
}
