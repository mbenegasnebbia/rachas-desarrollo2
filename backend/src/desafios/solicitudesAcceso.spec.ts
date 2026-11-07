import { runInNewContext } from 'node:vm';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Server } from 'node:http';
import ts from 'typescript';
import request from 'supertest';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  ValidationPipe,
  VersioningType,
  VERSION_NEUTRAL,
  UnauthorizedException,
  type INestApplication,
  type ExecutionContext,
} from '@nestjs/common';
import {
  AppVersionGuard,
  ContractInterceptor,
} from '../versioning/versioning.module';
import { VersionPolicy } from '../versioning/version-policy';
import { SolicitudesAccesoController } from './solicitudesAcceso.controller';
import 'reflect-metadata';
import { jest } from '@jest/globals';
import { Model, Types, type ClientSession } from 'mongoose';
import { CheckinsService } from '../checkins/checkins.service';
import { Checkin } from '../checkins/schemas/checkin.schema';
import { ProgresoService } from '../progreso/progreso.service';
import { BadRequestException } from '@nestjs/common';
import { DesafiosService } from './desafios.service';
import { SolicitudesAccesoService } from './solicitudesAcceso.service';
import { DesafiosController } from './desafios.controller';
import {
  SolicitudAcceso,
  SolicitudAccesoSchema,
} from './schemas/solicitudAcceso.schema';
import { Desafio } from './schemas/desafio.schema';
import { Persona } from '../personas/schemas/persona.schema';
import { PaginacionDto } from '../common/paginacion.dto';
import { RealtimeEventsService } from '../realtime/realtime-events.service';

// Dynamic Mongo-expression interpreter used only by this transactional test double.
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */
type Doc = Record<string, any>;
function copiar<T>(value: T): T {
  if (value instanceof Types.ObjectId)
    return new Types.ObjectId(value.toString()) as T;
  if (value instanceof Date) return new Date(value) as T;
  if (Array.isArray(value)) return value.map(copiar) as T;
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, copiar(v)]),
    ) as T;
  return value;
}
function fixture() {
  const creador = new Types.ObjectId(),
    persona = new Types.ObjectId(),
    otro = new Types.ObjectId(),
    id = new Types.ObjectId();
  let state: Record<string, Doc[]> = {
    personas: [creador, persona, otro].map((_id, i) => ({
      _id,
      nombre: 'Persona ' + i,
      alias: 'alias' + i,
      email: 'privado@example.invalid',
      firebaseUid: 'secreto',
      compartirDatosUso: true,
    })),
    desafios: [
      {
        _id: id,
        nombre: 'Caminar',
        descripcion: 'Privada',
        categoria: 'SALUD',
        codigoInvitacion: 'ABC123',
        creador,
        participantes: [creador],
        exParticipantes: [],
        maxParticipantes: 2,
        cancelado: false,
        fechaInicio: new Date('2026-11-01'),
        fechaFin: new Date('2026-11-30'),
      },
    ],
    solicitudes: [],
  };
  let version = 0,
    retries = 0,
    indice = true,
    fallarResolucion = false;
  const sesiones: unknown[] = [];
  type Session = { data: typeof state };
  const data = (session?: Session) => session?.data ?? state;
  const igual = (a: any, b: any) => String(a) === String(b);
  const expr = (v: any, d: Doc): any => {
    if (typeof v === 'string' && v.startsWith('$')) return d[v.slice(1)];
    if (v?.$size) return expr(v.$size, d).length;
    return v;
  };
  function coincide(d: Doc, filtro: Doc): boolean {
    return Object.entries(filtro).every(([key, value]) => {
      if (key === '$expr') {
        const [a, b] = Object.values(value)[0] as any[];
        return '$lt' in value
          ? expr(a, d) < expr(b, d)
          : expr(a, d) <= expr(b, d);
      }
      const actual = d[key];
      if (
        value &&
        typeof value === 'object' &&
        !(value instanceof Types.ObjectId) &&
        !(value instanceof Date)
      ) {
        if ('$in' in value) return value.$in.some((v: any) => igual(v, actual));
        if ('$ne' in value)
          return !(Array.isArray(actual) ? actual : [actual]).some((v: any) =>
            igual(v, value.$ne),
          );
        if ('$gte' in value) return actual >= value.$gte;
        if ('$lt' in value) return actual < value.$lt;
      }
      return (Array.isArray(actual) ? actual : [actual]).some((v: any) =>
        igual(v, value),
      );
    });
  }
  function query(fn: (session?: Session) => any) {
    let session: Session | undefined,
      skip = 0,
      limit = Infinity;
    const q = {
      session(s: Session) {
        session = s;
        sesiones.push(s);
        return q;
      },
      select() {
        return q;
      },
      sort() {
        return q;
      },
      skip(n: number) {
        skip = n;
        return q;
      },
      limit(n: number) {
        limit = n;
        return q;
      },
      then(resolve: (v: any) => any, reject: (e: unknown) => any) {
        return Promise.resolve()
          .then(() => {
            const result = fn(session);
            return copiar(
              Array.isArray(result)
                ? result
                    .slice()
                    .reverse()
                    .slice(skip, skip + limit)
                : result,
            );
          })
          .then(resolve, reject);
      },
    };
    return q;
  }
  const transaction = async (
    fn: (session: ClientSession) => Promise<unknown>,
  ) => {
    for (let intento = 0; intento < 40; intento++) {
      const base = version,
        session: Session = { data: copiar(state) };
      const result = await fn(session as unknown as ClientSession);
      // Optimistic commit double: conflicting snapshots rerun the WHOLE callback.
      if (version !== base) {
        retries++;
        continue;
      }
      state = session.data;
      version++;
      return result;
    }
    throw new Error('Demasiados conflictos simulados');
  };
  function model(collection: string) {
    return {
      db: { transaction },
      collection: {
        indexes: () =>
          Promise.resolve(
            indice
              ? [{ key: { desafio: 1, solicitante: 1 }, unique: true }]
              : [],
          ),
      },
      findById: (id: any) =>
        query((s) => data(s)[collection].find((d) => igual(d._id, id)) ?? null),
      findOne: (f: Doc) =>
        query((s) => data(s)[collection].find((d) => coincide(d, f)) ?? null),
      find: (f: Doc) =>
        query((s) => data(s)[collection].filter((d) => coincide(d, f))),
      countDocuments: (f: Doc) =>
        query((s) => data(s)[collection].filter((d) => coincide(d, f)).length),
      findOneAndUpdate: (f: Doc, update: Doc, opts: { session?: Session }) =>
        query(() => {
          const rows = data(opts.session)[collection],
            d = rows.find((d) => coincide(d, f));
          if (!d) return null;
          if (collection === 'solicitudes' && fallarResolucion)
            throw new Error('fallo de escritura');
          Object.assign(d, update.$set);
          for (const [k, v] of Object.entries(update.$inc ?? {}))
            d[k] = (d[k] ?? 0) + (v as number);
          for (const [k, v] of Object.entries(update.$addToSet ?? {}))
            if (!d[k].some((entry: any) => igual(entry, v))) d[k].push(v);
          for (const [k, v] of Object.entries(update.$pull ?? {}))
            d[k] = d[k].filter((entry: any) => !igual(entry, v));
          if (!opts.session) version++;
          return d;
        }),
      create: (docs: Doc[], opts: { session?: Session }) => {
        const rows = data(opts.session)[collection];
        const result: Doc[] = docs.map((doc) => ({
          ...doc,
          _id: new Types.ObjectId(),
        }));
        for (const doc of result) {
          if (
            rows.some(
              (d) =>
                igual(d.desafio, doc.desafio) &&
                igual(d.solicitante, doc.solicitante),
            )
          )
            return Promise.reject(
              Object.assign(new Error('duplicate'), { code: 11000 }),
            );
          rows.push(doc);
        }
        return Promise.resolve(copiar(result));
      },
    };
  }
  const desafiosBase = model('desafios'),
    personas = model('personas'),
    solicitudes = model('solicitudes');
  const desafios = Object.assign(
    class {
      private readonly doc: Doc;
      constructor(d: Doc) {
        this.doc = {
          ...d,
          _id: new Types.ObjectId(),
          cancelado: false,
          exParticipantes: [],
        };
      }
      save({ session }: { session: Session }) {
        data(session).desafios.push(copiar(this.doc));
        return Promise.resolve(this.doc);
      }
    },
    desafiosBase,
  );
  const participacion = new DesafiosService(
    desafios as unknown as Model<Desafio>,
    personas as unknown as Model<Persona>,
  );
  const service = new SolicitudesAccesoService(
    solicitudes as unknown as Model<SolicitudAcceso>,
    desafios as unknown as Model<Desafio>,
    personas as unknown as Model<Persona>,
    participacion,
  );
  return {
    service,
    participacion,
    creador: creador.toString(),
    persona: persona.toString(),
    otro: otro.toString(),
    id: id.toString(),
    get db() {
      return state as unknown as {
        personas: (Persona & { _id: Types.ObjectId })[];
        desafios: (Desafio & { _id: Types.ObjectId })[];
        solicitudes: (SolicitudAcceso & { _id: Types.ObjectId })[];
      };
    },
    get retries() {
      return retries;
    },
    sesiones,
    sinIndice() {
      indice = false;
    },
    fallar() {
      fallarResolucion = true;
    },
  };
}

/* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */
describe('Solicitudes de acceso (dobles transaccionales, sin Mongo/Atlas)', () => {
  beforeEach(() =>
    jest.useFakeTimers().setSystemTime(new Date('2026-11-06T15:00:00Z')),
  );
  afterEach(() => jest.useRealTimers());
  const pagina = new PaginacionDto();
  it('crea PENDING, devuelve minimo y nunca incorpora al solicitante', async () => {
    const f = fixture(),
      s = await f.service.solicitar('abc123', f.persona);
    expect(s.estado).toBe('PENDING');
    expect(s.resueltaEn).toBeNull();
    expect(f.db.desafios[0].participantes).toHaveLength(1);
    expect(JSON.stringify(s)).not.toMatch(
      /privado|firebaseUid|codigoInvitacion|Privada|compartirDatosUso/,
    );
  });
  it.each(['X', '!!!!!!', ''])(
    'rechaza codigo mal formado %s',
    async (codigo) => {
      const f = fixture();
      await expect(
        f.service.solicitar(codigo, f.persona),
      ).rejects.toBeInstanceOf(BadRequestException);
    },
  );
  it('rechaza codigo inexistente', async () => {
    const f = fixture();
    await expect(
      f.service.solicitar('ZZZ999', f.persona),
    ).rejects.toMatchObject({ status: 404 });
  });
  it('no escribe sin el indice unico requerido', async () => {
    const f = fixture();
    f.sinIndice();
    await expect(
      f.service.solicitar('ABC123', f.persona),
    ).rejects.toMatchObject({ status: 503 });
    expect(f.db.solicitudes).toHaveLength(0);
  });
  it('dos solicitudes concurrentes devuelven el mismo registro', async () => {
    const f = fixture();
    const [a, b] = await Promise.all([
      f.service.solicitar('ABC123', f.persona),
      f.service.solicitar('ABC123', f.persona),
    ]);
    expect(a.id).toBe(b.id);
    expect(f.db.solicitudes).toHaveLength(1);
    expect(f.retries).toBeGreaterThan(0);
  });
  it('rechaza participante, creador y ex participante', async () => {
    const f = fixture();
    await expect(
      f.service.solicitar('ABC123', f.creador),
    ).rejects.toMatchObject({ status: 409 });
    f.db.desafios[0].participantes.push(new Types.ObjectId(f.persona));
    await expect(
      f.service.solicitar('ABC123', f.persona),
    ).rejects.toMatchObject({ status: 409 });
    f.db.desafios[0].participantes.pop();
    f.db.desafios[0].exParticipantes.push(new Types.ObjectId(f.persona));
    await expect(
      f.service.solicitar('ABC123', f.persona),
    ).rejects.toMatchObject({ status: 409 });
  });
  it.each(['cancelado', 'finalizado', 'completo'])(
    'no solicita ni aprueba desafio %s',
    async (estado) => {
      const f = fixture(),
        s = await f.service.solicitar('ABC123', f.persona);
      if (estado === 'cancelado') f.db.desafios[0].cancelado = true;
      if (estado === 'finalizado')
        f.db.desafios[0].fechaFin = new Date('2026-11-05');
      if (estado === 'completo') f.db.desafios[0].maxParticipantes = 1;
      await expect(f.service.solicitar('ABC123', f.otro)).rejects.toMatchObject(
        { status: 409 },
      );
      await expect(
        f.service.resolver(f.id, s.id, f.creador, 'APPROVED'),
      ).rejects.toMatchObject({ status: 409 });
      expect(f.db.solicitudes[0].estado).toBe('PENDING');
    },
  );
  it('aprueba una vez incluso concurrentemente y registra resolucion', async () => {
    const f = fixture(),
      s = await f.service.solicitar('ABC123', f.persona);
    const results = await Promise.all([
      f.service.resolver(f.id, s.id, f.creador, 'APPROVED'),
      f.service.resolver(f.id, s.id, f.creador, 'APPROVED'),
    ]);
    expect(results.filter((r) => r.incorporado)).toHaveLength(1);
    expect(f.db.desafios[0].participantes.map(String)).toEqual([
      f.creador,
      f.persona,
    ]);
    expect(f.db.solicitudes[0]).toMatchObject({
      estado: 'APPROVED',
      resueltaPor: new Types.ObjectId(f.creador),
    });
    expect(f.db.solicitudes[0].resueltaEn).toBeInstanceOf(Date);
  });
  it('no permite resolver ni leer pendientes ajenos o cambiar desafio del path', async () => {
    const f = fixture(),
      s = await f.service.solicitar('ABC123', f.persona);
    await expect(
      f.service.resolver(f.id, s.id, f.otro, 'APPROVED'),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      f.service.pendientes(f.id, f.otro, pagina),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      f.service.resolver(
        new Types.ObjectId().toString(),
        s.id,
        f.creador,
        'APPROVED',
      ),
    ).rejects.toMatchObject({ status: 404 });
    await expect(f.service.cancelar(s.id, f.otro)).rejects.toMatchObject({
      status: 404,
    });
  });
  it.each(['REJECTED', 'CANCELLED'] as const)(
    'resuelve %s sin incorporar ni reabrir',
    async (estado) => {
      const f = fixture(),
        s = await f.service.solicitar('ABC123', f.persona);
      const resolver = () =>
        estado === 'REJECTED'
          ? f.service.resolver(f.id, s.id, f.creador, estado)
          : f.service.cancelar(s.id, f.persona);
      await resolver();
      await resolver();
      expect(f.db.solicitudes[0].estado).toBe(estado);
      expect((await f.service.solicitar('ABC123', f.persona)).estado).toBe(
        estado,
      );
      await expect(
        f.service.resolver(f.id, s.id, f.creador, 'APPROVED'),
      ).rejects.toMatchObject({ status: 409 });
      expect(f.db.desafios[0].participantes).toHaveLength(1);
    },
  );
  it('aprueba contra rechazo/cancelacion concurrente con un solo estado terminal', async () => {
    for (const cancelar of [false, true]) {
      const f = fixture(),
        s = await f.service.solicitar('ABC123', f.persona);
      const result = await Promise.allSettled([
        f.service.resolver(f.id, s.id, f.creador, 'APPROVED'),
        cancelar
          ? f.service.cancelar(s.id, f.persona)
          : f.service.resolver(f.id, s.id, f.creador, 'REJECTED'),
      ]);
      expect(result.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(
        f.db.desafios[0].participantes.some(
          (p: Types.ObjectId) => p.toString() === f.persona,
        ),
      ).toBe(f.db.solicitudes[0].estado === 'APPROVED');
    }
  });
  it('solo una de dos personas obtiene el ultimo cupo', async () => {
    const f = fixture(),
      a = await f.service.solicitar('ABC123', f.persona),
      b = await f.service.solicitar('ABC123', f.otro);
    const results = await Promise.allSettled([
      f.service.resolver(f.id, a.id, f.creador, 'APPROVED'),
      f.service.resolver(f.id, b.id, f.creador, 'APPROVED'),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(f.db.desafios[0].participantes).toHaveLength(2);
  });
  it('no supera cinco participaciones al aprobar simultaneamente en desafios distintos', async () => {
    const f = fixture();
    for (let i = 0; i < 4; i++)
      f.db.desafios.push({
        ...copiar(f.db.desafios[0]),
        _id: new Types.ObjectId(),
        codigoInvitacion: 'OTH00' + i,
        participantes: [new Types.ObjectId(f.persona)],
      });
    const otroDesafio = {
      ...copiar(f.db.desafios[0]),
      _id: new Types.ObjectId(),
      codigoInvitacion: 'DEF456',
    };
    f.db.desafios.push(otroDesafio);
    const a = await f.service.solicitar('ABC123', f.persona),
      b = await f.service.solicitar('DEF456', f.persona);
    const results = await Promise.allSettled([
      f.service.resolver(f.id, a.id, f.creador, 'APPROVED'),
      f.service.resolver(String(otroDesafio._id), b.id, f.creador, 'APPROVED'),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(
      f.db.desafios.filter((d) =>
        d.participantes.some((p: Types.ObjectId) => p.toString() === f.persona),
      ),
    ).toHaveLength(5);
  });
  it('crear y aprobar comparten la coordinacion del limite por persona', async () => {
    const f = fixture();
    for (let i = 0; i < 4; i++)
      f.db.desafios.push({
        ...copiar(f.db.desafios[0]),
        _id: new Types.ObjectId(),
        codigoInvitacion: 'OTH00' + i,
        participantes: [new Types.ObjectId(f.persona)],
      });
    const s = await f.service.solicitar('ABC123', f.persona);
    const results = await Promise.allSettled([
      f.participacion.create(
        {
          nombre: 'Nuevo desafio',
          categoria: 'SALUD',
          fechaInicio: '2026-11-07',
          fechaFin: '2026-11-10',
          maxParticipantes: 2,
        },
        f.persona,
      ),
      f.service.resolver(f.id, s.id, f.creador, 'APPROVED'),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(
      f.db.desafios.filter((d) =>
        d.participantes.some((p: Types.ObjectId) => p.toString() === f.persona),
      ),
    ).toHaveLength(5);
  });
  it('rollback si falla resolver despues de incorporar', async () => {
    const f = fixture(),
      s = await f.service.solicitar('ABC123', f.persona);
    f.fallar();
    await expect(
      f.service.resolver(f.id, s.id, f.creador, 'APPROVED'),
    ).rejects.toMatchObject({ status: 503 });
    expect(f.db.desafios[0].participantes).toHaveLength(1);
    expect(f.db.solicitudes[0].estado).toBe('PENDING');
  });
  it('lista propias, pendientes y creados con paginacion y sin datos privados', async () => {
    const f = fixture();
    await f.service.solicitar('ABC123', f.persona);
    await f.service.solicitar('ABC123', f.otro);
    const propias = await f.service.propias(f.persona, pagina),
      pendientes = await f.service.pendientes(f.id, f.creador, pagina);
    expect(propias.total).toBe(1);
    expect(propias.items[0].solicitante.id).toBe(f.persona);
    expect(pendientes.total).toBe(2);
    expect(JSON.stringify(pendientes)).not.toMatch(
      /email|firebaseUid|compartirDatosUso|codigoInvitacion|Privada/,
    );
    expect((await f.service.creados(f.otro, pagina)).total).toBe(0);
    expect((await f.service.creados(f.creador, pagina)).total).toBe(1);
  });
  it('pendiente no habilita check-ins ni ranking; aprobar no inventa puntos', async () => {
    const f = fixture(),
      solicitud = await f.service.solicitar('ABC123', f.persona);
    const personas = {
      findById: (id: string) =>
        Promise.resolve(f.db.personas.find((p) => p._id.toString() === id)),
      find: ({ _id }: { _id: { $in: Types.ObjectId[] } }) =>
        Promise.resolve(
          f.db.personas.filter((p) => _id.$in.some((id) => id.equals(p._id))),
        ),
    } as unknown as Model<Persona>;
    const desafios = {
      findById: () => Promise.resolve(f.db.desafios[0]),
    } as unknown as Model<Desafio>;
    const checkins = {
      find: () => Promise.resolve([]),
    } as unknown as Model<Checkin>;
    await expect(
      new CheckinsService(checkins, desafios, personas).create(
        f.id,
        f.persona,
        { fecha: '2026-11-06' },
      ),
    ).rejects.toMatchObject({ status: 403 });
    const progreso = new ProgresoService(personas, desafios, checkins);
    expect(
      (await progreso.ranking(f.id)).items.map((p) => p.personaId),
    ).not.toContain(f.persona);
    await f.service.resolver(f.id, solicitud.id, f.creador, 'APPROVED');
    expect(
      (await progreso.ranking(f.id)).items.find(
        (p) => p.personaId === f.persona,
      ),
    ).toMatchObject({ puntos: 0, rachaActual: 0 });
  });
  it('abandonar no sobrescribe una incorporacion simultanea', async () => {
    const f = fixture();
    f.db.desafios[0].maxParticipantes = 3;
    f.db.desafios[0].participantes.push(new Types.ObjectId(f.persona));
    const s = await f.service.solicitar('ABC123', f.otro);
    await Promise.all([
      f.participacion.leave(f.id, f.persona),
      f.service.resolver(f.id, s.id, f.creador, 'APPROVED'),
    ]);
    expect(f.db.desafios[0].participantes.map(String)).toEqual([
      f.creador,
      f.otro,
    ]);
    expect(f.db.desafios[0].exParticipantes.map(String)).toEqual([f.persona]);
  });
  it('reducir el cupo y aprobar concurrentemente nunca excede el maximo', async () => {
    const f = fixture();
    f.db.desafios[0].fechaInicio = new Date('2026-11-10');
    f.db.desafios[0].maxParticipantes = 3;
    f.db.desafios[0].participantes.push(new Types.ObjectId(f.persona));
    const s = await f.service.solicitar('ABC123', f.otro);
    const results = await Promise.allSettled([
      f.participacion.update(f.id, { maxParticipantes: 2 }, f.creador),
      f.service.resolver(f.id, s.id, f.creador, 'APPROVED'),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(f.db.desafios[0].participantes.length).toBeLessThanOrEqual(
      f.db.desafios[0].maxParticipantes,
    );
  });
  it('participantes solo expone id, nombre y alias, nunca email ni identidad Firebase', async () => {
    const f = fixture();
    expect(await f.participacion.findParticipantes(f.id)).toEqual([
      { id: f.creador, nombre: 'Persona 0', alias: 'alias0' },
    ]);
  });
  it('aprobar bloquea Persona antes de contar y comparte la misma sesion con la incorporacion', async () => {
    const f = fixture(),
      s = await f.service.solicitar('ABC123', f.persona);
    const bloquear = jest.spyOn(f.participacion, 'bloquearPersona');
    const contar = jest.spyOn(f.participacion, 'validarLimite');
    const incorporar = jest.spyOn(f.participacion, 'incorporarParticipante');
    await f.service.resolver(f.id, s.id, f.creador, 'APPROVED');
    const session = bloquear.mock.calls[0][1];
    expect(contar.mock.calls[0][1]).toBe(session);
    expect(incorporar.mock.calls[0][2]).toBe(session);
    expect(bloquear.mock.invocationCallOrder[0]).toBeLessThan(
      contar.mock.invocationCallOrder[0],
    );
    expect(contar.mock.invocationCallOrder[0]).toBeLessThan(
      incorporar.mock.invocationCallOrder[0],
    );
    expect(
      f.db.personas.find((p) => p._id.toString() === f.persona)
        ?.participacionVersion,
    ).toBe(1);
  });
  it('indice unico cubre tambien estados terminales', () => {
    const index = SolicitudAccesoSchema.indexes().find(
      ([keys]) => keys.desafio === 1 && keys.solicitante === 1,
    );
    expect(index?.[1].unique).toBe(true);
    expect(index?.[1].partialFilterExpression).toBeUndefined();
  });
  it('emite participante unido despues del commit, nunca en solicitud o repeticion', async () => {
    const f = fixture(),
      publish = jest.fn(),
      controller = new DesafiosController(
        f.participacion,
        { publish } as unknown as RealtimeEventsService,
        f.service,
      );
    const s = await f.service.solicitar('ABC123', f.persona);
    expect(publish).not.toHaveBeenCalled();
    await controller.aprobar(f.id, s.id, f.creador);
    await controller.aprobar(f.id, s.id, f.creador);
    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledWith(f.id, 'participante:unido', f.persona);
  });
});

type SolicitudWire = {
  id: string;
  estado: string;
  resueltaEn: string | null;
  resueltaPor: string | null;
  desafio: { id: string };
  solicitante: { id: string };
};
type ApiEnlazada = {
  solicitarAcceso: (codigo: string, uid?: string) => Promise<SolicitudWire>;
  listarSolicitudesPropias: (
    pagina: number,
    uid?: string,
  ) => Promise<{ items: SolicitudWire[]; total: number }>;
  cancelarSolicitud: (id: string, uid?: string) => Promise<SolicitudWire>;
  resolverSolicitud: (
    id: string,
    sid: string,
    accion: 'aprobar' | 'rechazar',
    uid?: string,
  ) => Promise<SolicitudWire>;
};

describe('Cliente Mobile real -> HTTP Nest -> servicio real (solo persistencia/identidad simuladas)', () => {
  let app: INestApplication;
  let f: ReturnType<typeof fixture>;
  let actor: string;
  let api: ApiEnlazada;
  let client: {
    request: (
      path: string,
      options?: Record<string, unknown>,
    ) => Promise<unknown>;
  };
  const publish = jest.fn();

  beforeEach(async () => {
    f = fixture();
    actor = f.persona;
    publish.mockClear();
    f.db.desafios[0].fechaInicio = new Date(Date.now() - 86400000);
    f.db.desafios[0].fechaFin = new Date(Date.now() + 30 * 86400000);
    f.db.desafios[0].maxParticipantes = 3;
    const module = await Test.createTestingModule({
      controllers: [DesafiosController, SolicitudesAccesoController],
      providers: [
        { provide: DesafiosService, useValue: f.participacion },
        { provide: SolicitudesAccesoService, useValue: f.service },
        { provide: RealtimeEventsService, useValue: { publish } },
      ],
    }).compile();
    app = module.createNestApplication();
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: ['1', '2', VERSION_NEUTRAL],
    });
    // Only the verified identity boundary is simulated; Firebase guard has its own suite.
    app.useGlobalGuards(
      {
        canActivate(context: ExecutionContext) {
          const req = context.switchToHttp().getRequest<{
            headers: Record<string, string>;
            persona?: { _id: Types.ObjectId };
          }>();
          const id = (req.headers.authorization ?? '').replace(/^Bearer /, '');
          if (![f.creador, f.persona, f.otro].includes(id))
            throw new UnauthorizedException();
          req.persona = { _id: new Types.ObjectId(id) };
          return true;
        },
      },
      new AppVersionGuard(
        new VersionPolicy(new ConfigService({ MIN_APP_VERSION: '1.1.0' })),
      ),
    );
    app.useGlobalInterceptors(new ContractInterceptor());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    const fetchLocal = async (url: string, options: RequestInit) => {
      const destino = new URL(url);
      const path = destino.pathname + destino.search,
        server = app.getHttpServer() as Server;
      let pending =
        options.method === 'POST'
          ? request(server).post(path)
          : options.method === 'PATCH'
            ? request(server).patch(path)
            : request(server).get(path);
      pending = pending.set(options.headers as Record<string, string>);
      if (typeof options.body === 'string')
        pending = pending.send(options.body);
      const response = await pending;
      const body: unknown = response.body;
      return {
        status: response.status,
        ok: response.status >= 200 && response.status < 300,
        text: () => Promise.resolve(JSON.stringify(body) ?? ''),
      };
    };
    function compilar(relative: string, deps: Record<string, unknown>) {
      const result: Record<string, unknown> = {};
      const codigo = ts.transpileModule(
        readFileSync(resolve(process.cwd(), '../mobile/src', relative), 'utf8'),
        {
          compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES2022,
          },
        },
      ).outputText;
      runInNewContext(
        codigo,
        {
          exports: result,
          require: (name: string) => {
            if (!(name in deps))
              throw new Error('Dependencia no simulada: ' + name);
            return deps[name];
          },
          process: { env: { EXPO_PUBLIC_API_URL: 'http://example.invalid' } },
          fetch: fetchLocal,
          AbortController,
          setTimeout,
          clearTimeout,
        },
        { filename: relative },
      );
      return result;
    }
    const version = compilar('api/version.ts', {
      'expo-constants': { default: { expoConfig: { version: '1.1.0' } } },
      'react-native': { Platform: { OS: 'web' } },
    });
    client = compilar('api/client.ts', {
      './version': version,
      '@/auth/session': {
        obtenerToken: (_force: boolean, expectedUid?: string) => {
          if (expectedUid && expectedUid !== actor)
            throw new Error('Cambio de cuenta');
          return Promise.resolve(actor);
        },
      },
    }) as unknown as typeof client;
    api = compilar('api/solicitudes.ts', {
      './client': client,
    }) as unknown as ApiEnlazada;
  });
  afterEach(async () => {
    await app.close();
  });

  it('solicita, lista y aprueba con los contratos reales sin incorporar antes de tiempo', async () => {
    const creada = await api.solicitarAcceso('abc123', f.persona);
    expect(creada.estado).toBe('PENDING');
    expect(creada.solicitante.id).toBe(f.persona);
    expect(creada.desafio.id).toBe(f.id);
    expect(f.db.desafios[0].participantes).toHaveLength(1);
    expect((await api.solicitarAcceso('ABC123', f.persona)).id).toBe(creada.id);
    expect((await api.listarSolicitudesPropias(1, f.persona)).total).toBe(1);
    actor = f.otro;
    expect((await api.listarSolicitudesPropias(1, f.otro)).items).toEqual([]);
    await expect(
      api.resolverSolicitud(f.id, creada.id, 'aprobar', f.otro),
    ).rejects.toMatchObject({ status: 403 });
    actor = f.creador;
    const aprobada = await api.resolverSolicitud(
      f.id,
      creada.id,
      'aprobar',
      f.creador,
    );
    expect(aprobada.estado).toBe('APPROVED');
    expect(typeof aprobada.resueltaEn).toBe('string');
    expect(aprobada.resueltaPor).toBe(f.creador);
    await api.resolverSolicitud(f.id, creada.id, 'aprobar', f.creador);
    expect(f.db.desafios[0].participantes.map(String)).toEqual([
      f.creador,
      f.persona,
    ]);
    expect(publish).toHaveBeenCalledTimes(1);
    actor = f.persona;
    expect(
      (await api.listarSolicitudesPropias(1, f.persona)).items[0].estado,
    ).toBe('APPROVED');
  });
  it('cancelar/rechazar no incorporan y repetir codigo devuelve el estado terminal', async () => {
    const propia = await api.solicitarAcceso('ABC123', f.persona);
    expect((await api.cancelarSolicitud(propia.id, f.persona)).estado).toBe(
      'CANCELLED',
    );
    expect((await api.cancelarSolicitud(propia.id, f.persona)).estado).toBe(
      'CANCELLED',
    );
    expect((await api.solicitarAcceso('ABC123', f.persona)).estado).toBe(
      'CANCELLED',
    );
    actor = f.otro;
    const otra = await api.solicitarAcceso('ABC123', f.otro);
    actor = f.creador;
    await api.resolverSolicitud(f.id, otra.id, 'rechazar', f.creador);
    await expect(
      api.resolverSolicitud(f.id, propia.id, 'aprobar', f.creador),
    ).rejects.toMatchObject({ status: 409 });
    actor = f.otro;
    expect((await api.solicitarAcceso('ABC123', f.otro)).estado).toBe(
      'REJECTED',
    );
    expect(f.db.desafios[0].participantes).toHaveLength(1);
    expect(publish).not.toHaveBeenCalled();
  });
  it('conserva errores 400/401/404/409/410/503 sin convertirlos en exito', async () => {
    await expect(api.solicitarAcceso('!!!', f.persona)).rejects.toMatchObject({
      status: 400,
    });
    await expect(
      api.solicitarAcceso('ZZZ999', f.persona),
    ).rejects.toMatchObject({ status: 404 });
    actor = f.otro;
    await expect(
      api.solicitarAcceso('ABC123', f.persona),
    ).rejects.toMatchObject({ status: 401 });
    f.db.desafios[0].maxParticipantes = 1;
    await expect(api.solicitarAcceso('ABC123', f.otro)).rejects.toMatchObject({
      status: 409,
    });
    await expect(
      client.request('/desafios/unirse/ABC123', { method: 'POST' }),
    ).rejects.toMatchObject({ status: 410 });
    f.sinIndice();
    await expect(api.solicitarAcceso('ABC123', f.otro)).rejects.toMatchObject({
      status: 503,
    });
    expect(f.db.solicitudes).toHaveLength(0);
  });
  it('fallo al resolver se propaga y conserva rollback de participacion y solicitud', async () => {
    const propia = await api.solicitarAcceso('ABC123', f.persona);
    actor = f.creador;
    f.fallar();
    await expect(
      api.resolverSolicitud(f.id, propia.id, 'aprobar', f.creador),
    ).rejects.toMatchObject({ status: 503 });
    expect(f.db.solicitudes[0].estado).toBe('PENDING');
    expect(f.db.desafios[0].participantes).toHaveLength(1);
    expect(publish).not.toHaveBeenCalled();
  });
});
