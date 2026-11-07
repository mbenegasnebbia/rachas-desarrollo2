import 'reflect-metadata';
import { jest } from '@jest/globals';
import { Types } from 'mongoose';
import {
  UnauthorizedException,
  ValidationPipe,
  VersioningType,
  VERSION_NEUTRAL,
  type INestApplication,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import request from 'supertest';
import type { Server } from 'node:http';
import { DesafiosController } from './desafios.controller';
import { SolicitudesAccesoController } from './solicitudesAcceso.controller';
import { DesafiosService } from './desafios.service';
import { SolicitudesAccesoService } from './solicitudesAcceso.service';
import { RealtimeEventsService } from '../realtime/realtime-events.service';
let Guard: typeof import('../auth/firebase-auth.guard').FirebaseAuthGuard;
jest.unstable_mockModule('firebase-admin/auth', () => ({ getAuth: jest.fn() }));
beforeAll(async () => {
  const ruta = '../auth/firebase-auth.guard';
  Guard = ((await import(ruta)) as typeof import('../auth/firebase-auth.guard'))
    .FirebaseAuthGuard;
});
import type { AuthService } from '../auth/auth.service';
import type { FirebasePersonaService } from '../auth/firebase-persona.service';
import { VersionPolicy } from '../versioning/version-policy';
import {
  AppVersionGuard,
  ContractInterceptor,
} from '../versioning/versioning.module';

describe('Solicitudes HTTP: guards reales y servicios aislados', () => {
  const persona = new Types.ObjectId().toString(),
    desafio = new Types.ObjectId().toString(),
    id = new Types.ObjectId().toString();
  const solicitud = {
    id,
    desafio: { id: desafio, nombre: 'Caminar', categoria: 'SALUD' },
    solicitante: { id: persona, nombre: 'Ana', alias: 'ana' },
    estado: 'PENDING' as const,
    solicitadaEn: new Date('2026-11-06T12:00:00Z'),
    resueltaEn: null,
    resueltaPor: null,
  };
  let app: INestApplication;
  const solicitar = jest.fn<SolicitudesAccesoService['solicitar']>();
  const propias = jest.fn<SolicitudesAccesoService['propias']>();
  const cancelar = jest.fn<SolicitudesAccesoService['cancelar']>();
  const resolver = jest.fn<SolicitudesAccesoService['resolver']>();
  const pendientes = jest.fn<SolicitudesAccesoService['pendientes']>();
  const creados = jest.fn<SolicitudesAccesoService['creados']>();
  const publish = jest.fn();
  beforeEach(async () => {
    jest.clearAllMocks();
    solicitar.mockResolvedValue(solicitud);
    propias.mockResolvedValue({
      items: [solicitud],
      total: 1,
      pagina: 1,
      limite: 10,
      paginas: 1,
    });
    pendientes.mockResolvedValue({
      items: [solicitud],
      total: 1,
      pagina: 1,
      limite: 10,
      paginas: 1,
    });
    creados.mockResolvedValue({
      items: [],
      total: 0,
      pagina: 1,
      limite: 10,
      paginas: 0,
    });
    cancelar.mockResolvedValue({ ...solicitud, estado: 'CANCELLED' });
    resolver.mockResolvedValue({
      solicitud: { ...solicitud, estado: 'APPROVED' },
      incorporado: true,
    });
    const module = await Test.createTestingModule({
      controllers: [DesafiosController, SolicitudesAccesoController],
      providers: [
        { provide: DesafiosService, useValue: {} },
        {
          provide: SolicitudesAccesoService,
          useValue: {
            solicitar,
            propias,
            cancelar,
            resolver,
            pendientes,
            creados,
          },
        },
        { provide: RealtimeEventsService, useValue: { publish } },
      ],
    }).compile();
    app = module.createNestApplication();
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: ['1', '2', VERSION_NEUTRAL],
    });
    const auth = {
      verifyToken: (token: string) => {
        if (token !== 'valido') throw new UnauthorizedException();
        return Promise.resolve({ uid: 'firebase-simulado' });
      },
    } as unknown as AuthService;
    const perfiles = {
      resolve: () =>
        Promise.resolve({
          _id: new Types.ObjectId(persona),
          perfilCompleto: true,
        }),
    } as unknown as FirebasePersonaService;
    const config = {
      get: (key: string) => (key === 'MIN_APP_VERSION' ? '1.1.0' : undefined),
    } as unknown as ConfigService;
    app.useGlobalGuards(
      new Guard(auth, perfiles, new Reflector()),
      new AppVersionGuard(new VersionPolicy(config)),
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
  });
  afterEach(async () => {
    await app.close();
  });
  it.each(['/v1', '/v2', ''])(
    'expone solicitudes y nunca ingreso inmediato en %s',
    async (base) => {
      const server = app.getHttpServer() as Server;
      const response = await request(server)
        .post(base + '/solicitudes')
        .send({ codigo: 'ABC123' })
        .auth('valido', { type: 'bearer' })
        .set('x-app-version', '1.1.0')
        .expect(200);
      expect(response.body).toMatchObject({
        id,
        estado: 'PENDING' as const,
        desafio: { id: desafio },
      });
      expect(solicitar).toHaveBeenCalledWith('ABC123', persona);
      expect(publish).not.toHaveBeenCalled();
      await request(server)
        .post(base + '/desafios/unirse/ABC123')
        .auth('valido', { type: 'bearer' })
        .set('x-app-version', '1.1.0')
        .expect(410);
      await request(server)
        .get(base + '/desafios/creados')
        .auth('valido', { type: 'bearer' })
        .set('x-app-version', '1.1.0')
        .expect(200);
      expect(creados).toHaveBeenCalledWith(
        persona,
        expect.objectContaining({ pagina: 1, limite: 10 }),
      );
      await request(server)
        .get(base + '/solicitudes')
        .auth('valido', { type: 'bearer' })
        .set('x-app-version', '1.1.0')
        .expect(200);
      expect(propias).toHaveBeenCalledWith(persona, expect.anything());
      await request(server)
        .get(base + '/desafios/' + desafio + '/solicitudes')
        .auth('valido', { type: 'bearer' })
        .set('x-app-version', '1.1.0')
        .expect(200);
      expect(pendientes).toHaveBeenCalledWith(
        desafio,
        persona,
        expect.anything(),
      );
    },
  );
  it('aprobacion, rechazo y cancelacion usan identidad del guard', async () => {
    const server = app.getHttpServer() as Server;
    await request(server)
      .patch('/v2/desafios/' + desafio + '/solicitudes/' + id + '/aprobar')
      .auth('valido', { type: 'bearer' })
      .set('x-app-version', '1.1.0')
      .expect(200);
    expect(resolver).toHaveBeenCalledWith(desafio, id, persona, 'APPROVED');
    await request(server)
      .patch('/v2/desafios/' + desafio + '/solicitudes/' + id + '/rechazar')
      .auth('valido', { type: 'bearer' })
      .set('x-app-version', '1.1.0')
      .expect(200);
    expect(resolver).toHaveBeenCalledWith(desafio, id, persona, 'REJECTED');
    await request(server)
      .patch('/v2/solicitudes/' + id + '/cancelar')
      .auth('valido', { type: 'bearer' })
      .set('x-app-version', '1.1.0')
      .expect(200);
    expect(cancelar).toHaveBeenCalledWith(id, persona);
  });
  it('rechaza sin Firebase, version incompatible, paginacion invalida o filtro de terceros', async () => {
    const server = app.getHttpServer() as Server;
    await request(server)
      .get('/v2/solicitudes')
      .set('x-app-version', '1.1.0')
      .expect(401);
    await request(server)
      .get('/v2/solicitudes')
      .auth('valido', { type: 'bearer' })
      .set('x-app-version', '1.0.0')
      .expect(426);
    await request(server)
      .get('/v2/solicitudes?limite=100')
      .auth('valido', { type: 'bearer' })
      .set('x-app-version', '1.1.0')
      .expect(400);
    await request(server)
      .get('/v2/solicitudes?solicitante=otro')
      .auth('valido', { type: 'bearer' })
      .set('x-app-version', '1.1.0')
      .expect(400);
    expect(propias).not.toHaveBeenCalled();
  });
});
