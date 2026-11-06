import 'reflect-metadata';
import { jest } from '@jest/globals';
import {
  Controller,
  Get,
  Post,
  Body,
  Module,
  Injectable,
  UnauthorizedException,
  VERSION_NEUTRAL,
  VersioningType,
  ValidationPipe,
  Logger,
} from '@nestjs/common';
import type {
  CanActivate,
  ExecutionContext,
  INestApplication,
} from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { PUBLIC_ROUTE } from '../auth/auth.decorators';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { Request, Response } from 'express';
import type { Server } from 'node:http';
import { Types } from 'mongoose';
import { VersioningModule, LegacyUsage } from './versioning.module';
import { VersionPolicy, compareVersions } from './version-policy';
import { contract, adaptInput } from './contract';
import { CreateCheckinDto } from '../checkins/dto/create-checkin.dto';
import { CreateDesafioDto } from '../desafios/dto/create-desafio.dto';
import { estadisticas } from '../common/calendario';

const settings = {
  MIN_APP_VERSION: '1.0.0',
  RECOMMENDED_APP_VERSION: '1.1.0',
  V1_SUNSET_DATE: '2027-06-30T23:59:59Z',
};
const config = () => new ConfigService(settings);
const authenticated = jest.fn();
@Injectable()
class FakeFirebaseGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest<Request>();
    if (
      this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE, [
        ctx.getHandler(),
        ctx.getClass(),
      ])
    )
      return true;
    if (req.headers.authorization !== 'Bearer simulated')
      throw new UnauthorizedException();
    authenticated();
    return true;
  }
}
@Module({ providers: [{ provide: APP_GUARD, useClass: FakeFirebaseGuard }] })
class FakeAuthModule {}
@Controller('desafios')
class FixtureController {
  @Get()
  list() {
    return [
      {
        fechaInicio: '2026-01-01',
        fechaFin: '2026-01-31',
        cancelado: false,
        id: 'retained',
        puntos: 35,
        _bonusPorRacha: 5,
      },
    ];
  }
  @Post()
  create(@Body() body: CreateDesafioDto) {
    return body;
  }
  @Post(':id/checkins')
  checkin(@Body() body: CreateCheckinDto) {
    return { ...body, puntos: 15 };
  }
}
@Controller('auth')
class FakeAuthController {
  @Get('me') me() {
    return { uid: 'simulated' };
  }
}
describe('HTTP versioning without Firebase, MongoDB or seeds', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [VersioningModule, FakeAuthModule],
      controllers: [FixtureController, FakeAuthController],
    })
      .overrideProvider(ConfigService)
      .useValue(config())
      .compile();
    app = module.createNestApplication({ logger: false });
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: ['1', '2', VERSION_NEUTRAL],
    });
    const usage = app.get(LegacyUsage);
    app.use(usage.use.bind(usage));
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(() => authenticated.mockClear());
  it.each(['/desafios', '/v1/desafios'])(
    'preserves the legacy contract at %s',
    async (path) => {
      const response = await request(app.getHttpServer() as Server)
        .get(path)
        .set('Authorization', 'Bearer simulated')
        .expect(200);
      expect(response.headers.deprecation).toMatch(/^@\d+$/);
      expect(response.headers.sunset).toBe('Wed, 30 Jun 2027 23:59:59 GMT');
      expect((response.body as Record<string, unknown>[])[0]).toMatchObject({
        id: 'retained',
        fechaFin: '2026-01-31',
        puntos: 35,
      });
      expect(
        (response.body as Record<string, unknown>[])[0],
      ).not.toHaveProperty('_bonusPorRacha');
    },
  );
  it('v2 changes representation without changing total or ID', async () => {
    const response = await request(app.getHttpServer() as Server)
      .get('/v2/desafios')
      .set('Authorization', 'Bearer simulated')
      .set('x-app-version', '1.1.0')
      .expect(200);
    expect(response.headers.deprecation).toBeUndefined();
    expect((response.body as Record<string, unknown>[])[0]).toMatchObject({
      id: 'retained',
      finalizaEn: '2026-01-31',
      puntos: { total: 35, bonusPorRacha: 5 },
    });
    expect((response.body as Record<string, unknown>[])[0]).not.toHaveProperty(
      'fechaFin',
    );
  });
  it('426 runs before authentication/profile resolution, even with missing bearer', async () => {
    const response = await request(app.getHttpServer() as Server)
      .get('/v1/desafios')
      .set('x-app-version', '0.9.9')
      .expect(426);
    expect((response.body as Record<string, unknown>).minimumVersion).toBe(
      '1.0.0',
    );
    expect(response.headers.sunset).toBeDefined();
    expect(authenticated).not.toHaveBeenCalled();
  });
  it('old version can discover policy without a token; authentication still requires one', async () => {
    for (const prefix of ['', '/v1', '/v2']) {
      await request(app.getHttpServer() as Server)
        .get(prefix + '/version-policy')
        .set('x-app-version', '0.0.1')
        .expect(200);
    }
    await request(app.getHttpServer() as Server)
      .get('/v2/auth/me')
      .set('x-app-version', '0.0.1')
      .expect(401);
    await request(app.getHttpServer() as Server)
      .get('/v2/auth/me')
      .set('x-app-version', '0.0.1')
      .set('Authorization', 'Bearer simulated')
      .expect(200);
  });
  it('rejects malformed versions and preserves Firebase authorization', async () => {
    await request(app.getHttpServer() as Server)
      .get('/v2/desafios')
      .set('x-app-version', 'invalid')
      .expect(400);
    await request(app.getHttpServer() as Server)
      .get('/v2/desafios')
      .set('x-app-version', '1.1.0')
      .expect(401);
  });
  it('v2 validates finalizaEn, rejects old field and preserves v1 creation shape', async () => {
    const body = {
      nombre: 'Ejemplo',
      categoria: 'SALUD',
      fechaInicio: '2026-01-01',
      fechaFin: '2026-01-31',
    };
    await request(app.getHttpServer() as Server)
      .post('/v1/desafios')
      .set('Authorization', 'Bearer simulated')
      .send(body)
      .expect(201);
    await request(app.getHttpServer() as Server)
      .post('/v2/desafios')
      .set('Authorization', 'Bearer simulated')
      .send(body)
      .expect(400);
    const { fechaFin, ...rest } = body;
    const response = await request(app.getHttpServer() as Server)
      .post('/v2/desafios')
      .set('Authorization', 'Bearer simulated')
      .send({ ...rest, finalizaEn: fechaFin })
      .expect(201);
    expect((response.body as Record<string, unknown>).finalizaEn).toBe(
      fechaFin,
    );
    expect(response.body).not.toHaveProperty('fechaFin');
  });
  it('keeps v2 validation and discovery exceptions on case-insensitive routes', async () => {
    await request(app.getHttpServer() as Server)
      .get('/V2/VERSION-POLICY')
      .set('x-app-version', '0.0.1')
      .expect(200);
    await request(app.getHttpServer() as Server)
      .post('/V2/DESAFIOS/id/CHECKINS')
      .set('Authorization', 'Bearer simulated')
      .send({ fecha: '2026-11-06' })
      .expect(400);
    const response = await request(app.getHttpServer() as Server)
      .get('/v1/desafios')
      .expect(401);
    expect(response.headers.deprecation).toBeDefined();
  });
  it('v2 requires a valid IANA zone; v1 remains compatible', async () => {
    const body = { fecha: '2026-11-06' };
    await request(app.getHttpServer() as Server)
      .post('/v1/desafios/id/checkins')
      .set('Authorization', 'Bearer simulated')
      .send(body)
      .expect(201);
    for (const extra of [{}, { zonaHoraria: 'invalid' }]) {
      await request(app.getHttpServer() as Server)
        .post('/v2/desafios/id/checkins')
        .set('Authorization', 'Bearer simulated')
        .send({ ...body, ...extra })
        .expect(400);
    }
    const response = await request(app.getHttpServer() as Server)
      .post('/v2/desafios/id/checkins')
      .set('Authorization', 'Bearer simulated')
      .send({ ...body, zonaHoraria: 'UTC' })
      .expect(201);
    expect((response.body as Record<string, unknown>).puntos).toEqual({
      total: 15,
      bonusPorRacha: 5,
    });
  });
});
describe('Policy and adapters', () => {
  it('counts legacy requests without logging identity or discovery traffic', () => {
    const log = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    try {
      const usage = new LegacyUsage(new VersionPolicy(config()));
      const finishes: (() => void)[] = [];
      const setHeader = jest.fn();
      const response = {
        statusCode: 401,
        setHeader,
        on: (_: string, finish: () => void) => {
          finishes.push(finish);
        },
      } as unknown as Response;
      const next = jest.fn();
      for (const path of [
        '/version-policy',
        '/v1/desafios',
        '/desafios',
        '/v2/desafios',
      ]) {
        usage.use(
          {
            path,
            method: 'GET',
            headers: { authorization: 'Bearer dummy-secret' },
          } as Request,
          response,
          next,
        );
      }
      finishes.forEach((finish) => finish());
      expect(log).toHaveBeenLastCalledWith({
        event: 'api.v1.request',
        count: 2,
        method: 'GET',
        status: 401,
      });
      expect(JSON.stringify(log.mock.calls)).not.toContain('dummy-secret');
      expect(setHeader).toHaveBeenCalledTimes(4);
    } finally {
      log.mockRestore();
    }
  });
  it('compares releases numerically, including 1.10 vs 1.9', () => {
    expect(compareVersions('1.10.0', '1.9.99')).toBe(1);
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
    expect(() => compareVersions('1.0', '1.0.0')).toThrow();
  });
  it('fails startup for inconsistent configuration', () => {
    expect(
      () => new VersionPolicy(new ConfigService({ MIN_APP_VERSION: '2.0.0' })),
    ).toThrow();
    expect(
      () => new VersionPolicy(new ConfigService({ V1_SUNSET_DATE: 'invalid' })),
    ).toThrow();
  });
  it('preserves ObjectIds, bonus totals, paused and future states without mutating data', () => {
    const stats = estadisticas(
      [
        { fecha: '2026-11-01', puntos: 10 },
        { fecha: '2026-11-02', puntos: 15 },
        { fecha: '2026-11-03', puntos: 20 },
      ],
      '2026-11-03',
    );
    expect(contract(stats, true)).toMatchObject({
      puntos: { total: 45, bonusPorRacha: 15 },
    });
    expect(contract(stats, false)).toMatchObject({ puntos: 45 });
    const id = new Types.ObjectId();
    const original = {
      id,
      fechaInicio: '2026-11-01',
      fechaFin: '2026-11-30',
      estado: 'PAUSADO',
    };
    expect(contract(original, true)).toMatchObject({
      id: id.toString(),
      estado: 'PAUSADO',
    });
    expect(original.fechaFin).toBe('2026-11-30');
  });
  it('does not rewrite unrelated bodies', () => {
    const req = {
      path: '/v2/auth/perfil',
      method: 'PATCH',
      body: { fechaFin: 'x' },
    } as Request;
    adaptInput(req);
    expect(req.body).toEqual({ fechaFin: 'x' });
  });
});
