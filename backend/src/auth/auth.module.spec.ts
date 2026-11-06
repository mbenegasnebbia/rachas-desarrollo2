import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { APP_GUARD } from '@nestjs/core';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { CompleteProfileDto } from './complete-profile.dto';

jest.unstable_mockModule('firebase-admin/auth', () => ({ getAuth: jest.fn() }));

describe('AuthModule y DTO (sin servidor ni conexión MongoDB)', () => {
  let fixture: TestingModule;
  let moduleType: typeof import('./auth.module').AuthModule;

  beforeAll(async () => {
    const modulePath = './auth.module';
    moduleType = ((await import(modulePath)) as typeof import('./auth.module'))
      .AuthModule;
    fixture = await Test.createTestingModule({ imports: [moduleType] })
      .overrideProvider(getModelToken('Persona'))
      .useValue({})
      .compile();
  });

  afterAll(async () => {
    await fixture?.close();
  });

  it('compila la inyección y registra el guard global sin inicializar modelos', () => {
    expect(fixture).toBeDefined();
    const providers = Reflect.getMetadata(
      MODULE_METADATA.PROVIDERS,
      moduleType,
    ) as unknown[];
    expect(
      providers.some(
        (provider) =>
          typeof provider === 'object' &&
          provider !== null &&
          'provide' in provider &&
          provider.provide === APP_GUARD,
      ),
    ).toBe(true);
  });

  it('rechaza asignar firebaseUid o perfilCompleto desde el body', async () => {
    const pipe = new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    await expect(
      pipe.transform(
        {
          alias: 'alias_valido',
          firebaseUid: 'uid-ajeno',
          perfilCompleto: true,
        },
        { type: 'body', metatype: CompleteProfileDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it.each(['ab', 'alias con espacio', 'alias-invalido'])(
    'rechaza alias inválido %s',
    async (alias) => {
      const pipe = new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      });
      await expect(
        pipe.transform(
          { alias },
          { type: 'body', metatype: CompleteProfileDto },
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    },
  );
  it.each([
    { alias: 'alias_valido', nombre: null },
    { alias: 'alias_valido', zonaHoraria: null },
  ])('rechaza valores null que invalidarían el perfil: %p', async (body) => {
    const pipe = new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    await expect(
      pipe.transform(body, { type: 'body', metatype: CompleteProfileDto }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
