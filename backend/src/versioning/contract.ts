import { BadRequestException } from '@nestjs/common';
import type { Request } from 'express';
import { estadoDe } from '../common/calendario';

export const isV2 = (request: Pick<Request, 'path'>) =>
  /^\/v2(?:\/|$)/i.test(request.path);

// Boundary adapter: persistence and business services retain their original model.
export function adaptInput(request: Request): void {
  if (!isV2(request)) return;
  const body = request.body as Record<string, unknown> | undefined;
  if (!body || typeof body !== 'object' || Array.isArray(body)) return;
  if (
    /^\/v2\/desafios(?:\/[^/]+)?\/?$/i.test(request.path) &&
    ['POST', 'PATCH'].includes(request.method)
  ) {
    if ('fechaFin' in body)
      throw new BadRequestException('v2 utiliza finalizaEn');
    if ('finalizaEn' in body) {
      body.fechaFin = body.finalizaEn;
      delete body.finalizaEn;
    }
  }
  if (
    request.method === 'POST' &&
    /^\/v2\/desafios\/[^/]+\/checkins\/?$/i.test(request.path)
  ) {
    if (typeof body.zonaHoraria !== 'string' || !body.zonaHoraria)
      throw new BadRequestException('zonaHoraria es obligatoria en v2');
    try {
      new Intl.DateTimeFormat('en', { timeZone: body.zonaHoraria });
    } catch {
      throw new BadRequestException(
        'zonaHoraria debe ser una zona IANA válida',
      );
    }
  }
}

export function contract(value: unknown, v2: boolean): unknown {
  // Invoke Mongoose's existing JSON transforms before traversing ObjectIds/Dates.
  if (value === undefined) return value;
  const plain: unknown = JSON.parse(JSON.stringify(value));
  const visit = (item: unknown): unknown => {
    if (Array.isArray(item)) return item.map(visit);
    if (!item || typeof item !== 'object') return item;
    const source = item as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(source)) {
      if (key === '_bonusPorRacha') continue;
      if (
        !v2 &&
        key === 'zonaHoraria' &&
        'desafio' in source &&
        'fecha' in source
      )
        continue;
      result[v2 && key === 'fechaFin' ? 'finalizaEn' : key] = visit(entry);
    }
    if (v2 && typeof source.puntos === 'number') {
      result.puntos = {
        total: source.puntos,
        bonusPorRacha:
          typeof source._bonusPorRacha === 'number'
            ? source._bonusPorRacha
            : 'fecha' in source
              ? Math.max(0, source.puntos - 10)
              : 0,
      };
    }
    if (
      v2 &&
      typeof source.fechaInicio === 'string' &&
      typeof source.fechaFin === 'string'
    ) {
      result.estado =
        typeof source.estado === 'string'
          ? source.estado
          : estadoDe({
              cancelado: source.cancelado === true,
              fechaInicio: new Date(source.fechaInicio),
              fechaFin: new Date(source.fechaFin),
            });
    }
    return result;
  };
  return visit(plain);
}
