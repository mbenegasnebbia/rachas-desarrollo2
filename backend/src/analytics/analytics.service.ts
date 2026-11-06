import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { PipelineStage } from 'mongoose';
import { Persona } from '../personas/schemas/persona.schema';
import { AnalyticsEvent } from './analytics.schema';
import { validateEvent } from './events';

export function metricsPipeline(
  start: Date,
  end: Date,
  now = new Date(),
): PipelineStage[] {
  const time = '$occurredAt';
  return [
    {
      $match: {
        occurredAt: { $gte: start, $lte: end },
        receivedAt: { $gte: new Date(now.getTime() - 30 * 86400000) },
      },
    },
    {
      $facet: {
        activasPorDia: [
          {
            $group: {
              _id: {
                fecha: {
                  $dateToString: {
                    date: time,
                    format: '%Y-%m-%d',
                    timezone: 'UTC',
                  },
                },
                persona: '$persona',
              },
            },
          },
          { $group: { _id: '$_id.fecha', personas: { $sum: 1 } } },
          { $sort: { _id: 1 } },
          { $project: { _id: 0, fecha: '$_id', personas: 1 } },
        ],
        checkinsPorVersion: [
          { $match: { name: 'checkin_hecho' } },
          { $group: { _id: '$appVersion', cantidad: { $sum: 1 } } },
          { $sort: { _id: 1 } },
          { $project: { _id: 0, version: '$_id', cantidad: 1 } },
        ],
        embudo: [
          {
            $match: {
              name: {
                $in: [
                  'ingreso_exitoso',
                  'desafio_creado',
                  'desafio_unido',
                  'checkin_hecho',
                ],
              },
            },
          },
          {
            $set: {
              _order: {
                $indexOfArray: [
                  [
                    'ingreso_exitoso',
                    'desafio_creado',
                    'desafio_unido',
                    'checkin_hecho',
                  ],
                  '$name',
                ],
              },
            },
          },
          { $sort: { occurredAt: 1, _order: 1 } },
          {
            $group: {
              _id: '$persona',
              pasos: { $push: { name: '$name', fecha: time } },
            },
          },
          {
            $project: {
              paso: {
                $reduce: {
                  input: '$pasos',
                  initialValue: 0,
                  in: {
                    $switch: {
                      branches: [
                        {
                          case: {
                            $and: [
                              { $eq: ['$$value', 0] },
                              { $eq: ['$$this.name', 'ingreso_exitoso'] },
                            ],
                          },
                          then: 1,
                        },
                        {
                          case: {
                            $and: [
                              { $eq: ['$$value', 1] },
                              {
                                $in: [
                                  '$$this.name',
                                  ['desafio_creado', 'desafio_unido'],
                                ],
                              },
                            ],
                          },
                          then: 2,
                        },
                        {
                          case: {
                            $and: [
                              { $eq: ['$$value', 2] },
                              { $eq: ['$$this.name', 'checkin_hecho'] },
                            ],
                          },
                          then: 3,
                        },
                      ],
                      default: '$$value',
                    },
                  },
                },
              },
            },
          },
          {
            $group: {
              _id: null,
              ingresaron: { $sum: { $cond: [{ $gte: ['$paso', 1] }, 1, 0] } },
              primerDesafio: {
                $sum: { $cond: [{ $gte: ['$paso', 2] }, 1, 0] },
              },
              primerCheckin: {
                $sum: { $cond: [{ $gte: ['$paso', 3] }, 1, 0] },
              },
            },
          },
          { $project: { _id: 0 } },
        ],
      },
    },
  ];
}
@Injectable()
export class AnalyticsService {
  constructor(
    @InjectModel(AnalyticsEvent.name)
    private readonly events: Model<AnalyticsEvent>,
    @InjectModel(Persona.name) private readonly personas: Model<Persona>,
    private readonly config: ConfigService,
  ) {}
  async consent(uid: string) {
    const person = await this.personas.findOne({ firebaseUid: uid });
    return { enabled: person?.compartirDatosUso === true };
  }
  async setConsent(uid: string, enabled: boolean) {
    const person = await this.personas.findOneAndUpdate(
      { firebaseUid: uid },
      { $set: { compartirDatosUso: enabled } },
      { new: true },
    );
    if (!person)
      throw new NotFoundException(
        'Ingresá a Rachas antes de cambiar el consentimiento',
      );
    return { enabled: person.compartirDatosUso === true };
  }
  private async checkIndexes() {
    try {
      const indexes = await this.events.collection.indexes();
      const ttl = indexes.some(
        (i) =>
          Object.keys(i.key).length === 1 &&
          i.key.receivedAt === 1 &&
          i.expireAfterSeconds === 2592000 &&
          !i.partialFilterExpression,
      );
      const unique = indexes.some(
        (i) =>
          Object.keys(i.key).length === 2 &&
          i.key.persona === 1 &&
          i.key.eventId === 1 &&
          i.unique === true &&
          !i.partialFilterExpression &&
          !i.sparse,
      );
      if (!ttl || !unique) throw new Error();
    } catch {
      throw new ServiceUnavailableException(
        'Analytics requiere índices TTL y de idempotencia provisionados manualmente',
      );
    }
  }
  async receive(uid: string, values: unknown[]) {
    if (!Array.isArray(values) || values.length < 1 || values.length > 25)
      throw new BadRequestException('Enviar entre 1 y 25 eventos');
    const now = new Date();
    const validated = values.map((value) =>
      validateEvent(value, now.getTime()),
    );
    const person = await this.personas.findOne({ firebaseUid: uid });
    if (person?.compartirDatosUso !== true)
      throw new ForbiddenException('Compartir datos de uso está desactivado');
    await this.checkIndexes();
    const distinct = [
      ...new Map(validated.map((event) => [event.eventId, event])).values(),
    ];
    try {
      await this.events.bulkWrite(
        distinct.map((event) => ({
          updateOne: {
            filter: { persona: person._id, eventId: event.eventId },
            update: {
              $setOnInsert: {
                ...event,
                occurredAt: new Date(event.occurredAt),
                persona: person._id,
                receivedAt: now,
              },
            },
            upsert: true,
          },
        })),
        { ordered: false },
      );
    } catch {
      // Never acknowledge an uncertain write. Unique keys make the retry safe.
      throw new ServiceUnavailableException(
        'No se pudo guardar el lote de analytics',
      );
    }
    return { acceptedIds: distinct.map((event) => event.eventId) };
  }
  async metrics(uid: string, desde?: string, hasta?: string) {
    const readers = (this.config.get<string>('ANALYTICS_READER_UIDS') || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (!readers.includes(uid))
      throw new ForbiddenException(
        'Métricas reservadas a operadores autorizados',
      );
    const now = new Date();
    const endDay = hasta ?? now.toISOString().slice(0, 10);
    const startDay =
      desde ??
      new Date(now.getTime() - 29 * 86400000).toISOString().slice(0, 10);
    const parse = (day: string) => {
      const date = new Date(day + 'T00:00:00Z');
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
        !Number.isFinite(date.getTime()) ||
        date.toISOString().slice(0, 10) !== day
      )
        throw new BadRequestException('Usar fechas UTC YYYY-MM-DD válidas');
      return date;
    };
    const start = parse(startDay),
      end = new Date(parse(endDay).getTime() + 86400000 - 1);
    if (
      end < start ||
      end.getTime() - start.getTime() >= 30 * 86400000 ||
      endDay > now.toISOString().slice(0, 10)
    )
      throw new BadRequestException(
        'El intervalo debe ser de hasta 30 días, sin fechas futuras',
      );
    const [result] = await this.events.aggregate<Record<string, unknown>>(
      metricsPipeline(start, end, now),
    );
    const data = result ?? {
      activasPorDia: [],
      embudo: [],
      checkinsPorVersion: [],
    };
    return {
      ...data,
      embudo:
        Array.isArray(data.embudo) && data.embudo.length
          ? (data.embudo[0] as unknown)
          : { ingresaron: 0, primerDesafio: 0, primerCheckin: 0 },
    };
  }
}
