import 'reflect-metadata';
import { jest } from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import { Types, Model } from 'mongoose';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { ExecutionContext } from '@nestjs/common';
import { FIREBASE_ONLY, PUBLIC_ROUTE } from '../auth/auth.decorators';
import type { FirebaseRequest } from '../auth/firebase-identity';
import { AnalyticsEvent, AnalyticsSchema } from './analytics.schema';
import { Persona, PersonaSchema } from '../personas/schemas/persona.schema';
import { AnalyticsService, metricsPipeline } from './analytics.service';
import {
  AnalyticsController,
  ConsentDto,
  EventsDto,
  MetricsDto,
} from './analytics.module';
import { validateEvent } from './events';
import { AppVersionGuard } from '../versioning/versioning.module';
import { VersionPolicy } from '../versioning/version-policy';
const uid = 'trusted-firebase-uid';
const personId = new Types.ObjectId();
const id = '00000000-0000-4000-8000-000000000001';
const challenge = new Types.ObjectId().toString();
const now = new Date('2026-11-06T12:00:00.000Z');
const event = (
  name = 'ingreso_exitoso',
  properties: Record<string, unknown> = {},
) => ({
  eventId: id,
  name,
  properties,
  appVersion: '1.1.0',
  platform: 'web',
  occurredAt: now.toISOString(),
});
function fixture(enabled = true, indexes = true) {
  const bulkWrite = jest
    .fn<(...args: unknown[]) => Promise<unknown>>()
    .mockResolvedValue({});
  const aggregate = jest
    .fn<(...args: unknown[]) => Promise<unknown[]>>()
    .mockResolvedValue([
      {
        activasPorDia: [{ fecha: '2026-11-06', personas: 2 }],
        checkinsPorVersion: [{ version: '1.1.0', cantidad: 3 }],
        embudo: [{ ingresaron: 2, primerDesafio: 1, primerCheckin: 1 }],
      },
    ]);
  const list = jest.fn<() => Promise<unknown[]>>().mockResolvedValue(
    indexes
      ? [
          { key: { receivedAt: 1 }, expireAfterSeconds: 2592000 },
          { key: { persona: 1, eventId: 1 }, unique: true },
        ]
      : [],
  );
  const findOne = jest
    .fn<(...args: unknown[]) => Promise<unknown>>()
    .mockResolvedValue({ _id: personId, compartirDatosUso: enabled });
  const findOneAndUpdate = jest
    .fn<(...args: unknown[]) => Promise<unknown>>()
    .mockResolvedValue({ compartirDatosUso: false });
  const service = new AnalyticsService(
    {
      bulkWrite,
      aggregate,
      collection: { indexes: list },
    } as unknown as Model<AnalyticsEvent>,
    { findOne, findOneAndUpdate } as unknown as Model<Persona>,
    new ConfigService({ ANALYTICS_READER_UIDS: uid }),
  );
  return { service, bulkWrite, aggregate, list, findOne, findOneAndUpdate };
}
beforeEach(() => jest.useFakeTimers().setSystemTime(now));
afterEach(() => jest.useRealTimers());
describe('Analytics catalog and DTOs', () => {
  it.each([
    ['ingreso_exitoso', {}],
    ['desafio_creado', { desafio_id: challenge, categoria: 'SALUD' }],
    ['desafio_unido', { desafio_id: challenge }],
    ['checkin_hecho', { desafio_id: challenge }],
    ['ranking_consultado', { desafio_id: challenge }],
    ['racha_perdida', { desafio_id: challenge, racha_anterior: 7 }],
    [
      'aviso_actualizacion_mostrado',
      { tipo: 'obligatoria', version_objetivo: '1.2.0' },
    ],
  ])('accepts only the intended properties of %s', (name, properties) => {
    expect(
      validateEvent(
        event(name, properties as Record<string, unknown>),
        now.getTime(),
      ).name,
    ).toBe(name);
  });
  it.each([
    { name: 'unknown_event' },
    { personaId: personId.toString() },
    { properties: { email: 'dummy@example.invalid' } },
    { properties: { nota: 'private text' } },
    { eventId: 'not-a-uuid' },
    { platform: 'unknown' },
    { appVersion: '1.0' },
    { occurredAt: '2026-10-01T00:00:00.000Z' },
    { occurredAt: '2026-11-07T00:00:00.000Z' },
  ])('rejects malformed, private or stale data: %p', (patch) => {
    expect(() =>
      validateEvent({ ...event(), ...patch }, now.getTime()),
    ).toThrow();
  });
  it('validates the envelope, consent boolean and query without coercion', async () => {
    const options = { whitelist: true, forbidNonWhitelisted: true };
    expect(
      await validate(plainToInstance(ConsentDto, { enabled: false }), options),
    ).toHaveLength(0);
    expect(
      (
        await validate(
          plainToInstance(ConsentDto, { enabled: 'false' }),
          options,
        )
      ).length,
    ).toBeGreaterThan(0);
    expect(
      (
        await validate(
          plainToInstance(EventsDto, { events: [event()], uid }),
          options,
        )
      ).length,
    ).toBeGreaterThan(0);
    expect(
      (
        await validate(
          plainToInstance(EventsDto, { events: Array(26).fill(event()) }),
          options,
        )
      ).length,
    ).toBeGreaterThan(0);
    expect(
      (
        await validate(
          plainToInstance(MetricsDto, {
            desde: 'invalid',
            personaId: 'arbitrary',
          }),
          options,
        )
      ).length,
    ).toBeGreaterThan(0);
  });
});
describe('Consent, identity and idempotent persistence (mocked models)', () => {
  it('derives Persona from verified UID and never overwrites the original event/TTL', async () => {
    const f = fixture();
    expect(await f.service.receive(uid, [event(), event()])).toEqual({
      acceptedIds: [id],
    });
    expect(f.findOne).toHaveBeenCalledWith({ firebaseUid: uid });
    const ops = f.bulkWrite.mock.calls[0][0] as {
      updateOne: { filter: unknown; update: Record<string, unknown> };
    }[];
    expect(ops).toHaveLength(1);
    expect(ops[0].updateOne.filter).toEqual({ persona: personId, eventId: id });
    expect(Object.keys(ops[0].updateOne.update)).toEqual(['$setOnInsert']);
    expect(ops[0].updateOne.update.$setOnInsert).toMatchObject({
      persona: personId,
      receivedAt: now,
    });
    await f.service.receive(uid, [event()]);
    expect(f.bulkWrite).toHaveBeenCalledTimes(2); // same unique filter, not another insertion key
  });
  it('refuses disabled or unknown consent without writing', async () => {
    const f = fixture(false);
    await expect(f.service.receive(uid, [event()])).rejects.toMatchObject({
      status: 403,
    });
    expect(f.bulkWrite).not.toHaveBeenCalled();
    f.findOne.mockResolvedValue(null);
    expect(await f.service.consent(uid)).toEqual({ enabled: false });
  });
  it('requires correct TTL and uniqueness indexes; never creates them', async () => {
    const f = fixture(true, false);
    await expect(f.service.receive(uid, [event()])).rejects.toMatchObject({
      status: 503,
    });
    expect(f.bulkWrite).not.toHaveBeenCalled();
    expect(AnalyticsSchema.options.autoCreate).toBe(false);
    expect(AnalyticsSchema.options.autoIndex).toBe(false);
    expect(AnalyticsSchema.indexes()).toEqual(
      expect.arrayContaining([
        expect.arrayContaining([
          { receivedAt: 1 },
          expect.objectContaining({ expireAfterSeconds: 2592000 }),
        ]),
      ]),
    );
  });
  it('does not ACK uncertain or concurrent duplicate writes; a retry is safe', async () => {
    const f = fixture();
    f.bulkWrite.mockRejectedValueOnce({ writeErrors: [{ code: 11000 }] });
    await expect(f.service.receive(uid, [event()])).rejects.toMatchObject({
      status: 503,
    });
    expect(await f.service.receive(uid, [event()])).toEqual({
      acceptedIds: [id],
    });
  });
  it('updates only the authenticated existing profile without upsert', async () => {
    const f = fixture();
    await f.service.setConsent(uid, false);
    expect(f.findOneAndUpdate).toHaveBeenCalledWith(
      { firebaseUid: uid },
      { $set: { compartirDatosUso: false } },
      { new: true },
    );
    f.findOneAndUpdate.mockResolvedValue(null);
    await expect(f.service.setConsent(uid, true)).rejects.toMatchObject({
      status: 404,
    });
    expect(PersonaSchema.path('compartirDatosUso').options.default).toBe(false);
  });
  it('has Firebase-only authentication metadata, never a public bypass', () => {
    expect(Reflect.getMetadata(FIREBASE_ONLY, AnalyticsController)).toBe(true);
    expect(
      Reflect.getMetadata(PUBLIC_ROUTE, AnalyticsController),
    ).toBeUndefined();
    const service = fixture().service;
    const controller = new AnalyticsController(service);
    expect(() => controller.consent({} as FirebaseRequest)).toThrow();
  });
  it('lets an outdated app send analytics/consent but still blocks business operations', () => {
    const guard = new AppVersionGuard(
      new VersionPolicy(
        new ConfigService({
          MIN_APP_VERSION: '1.2.0',
          RECOMMENDED_APP_VERSION: '1.2.0',
        }),
      ),
    );
    const ctx = (path: string) =>
      ({
        getType: () => 'http',
        switchToHttp: () => ({
          getRequest: () => ({ path, headers: { 'x-app-version': '1.1.0' } }),
        }),
      }) as unknown as ExecutionContext;
    expect(guard.canActivate(ctx('/v2/analytics/events'))).toBe(true);
    expect(guard.canActivate(ctx('/v1/analytics/consent'))).toBe(true);
    expect(() => guard.canActivate(ctx('/v2/desafios'))).toThrow();
    expect(() => guard.canActivate(ctx('/v2/analytics/metrics'))).toThrow();
  });
});
describe('Private aggregated metrics', () => {
  it('denies regular accounts before querying events', async () => {
    const f = fixture();
    await expect(f.service.metrics('not-an-operator')).rejects.toMatchObject({
      status: 403,
    });
    expect(f.aggregate).not.toHaveBeenCalled();
  });
  it('executes a Mongo aggregation, scopes retention, and returns only aggregate shapes', async () => {
    const f = fixture();
    const data = await f.service.metrics(uid, '2026-11-01', '2026-11-06');
    expect(f.aggregate).toHaveBeenCalledWith(
      metricsPipeline(
        new Date('2026-11-01T00:00:00Z'),
        new Date('2026-11-06T23:59:59.999Z'),
        now,
      ),
    );
    expect(data).toEqual({
      activasPorDia: [{ fecha: '2026-11-06', personas: 2 }],
      checkinsPorVersion: [{ version: '1.1.0', cantidad: 3 }],
      embudo: { ingresaron: 2, primerDesafio: 1, primerCheckin: 1 },
    });
    expect(JSON.stringify(data)).not.toContain(uid);
    expect(JSON.stringify(data)).not.toContain(personId.toString());
  });
  it.each([
    ['2026-02-30', '2026-03-01'],
    ['2026-10-01', '2026-11-06'],
    ['2026-11-07', '2026-11-07'],
  ])('rejects invalid date ranges %s/%s', async (from, to) => {
    await expect(
      fixture().service.metrics(uid, from, to),
    ).rejects.toMatchObject({ status: 400 });
  });
});
