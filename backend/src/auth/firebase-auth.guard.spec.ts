import { Reflector } from '@nestjs/core';
import { Types } from 'mongoose';
import type { FirebasePersonaService } from './firebase-persona.service';
import type { PersonaDocument } from '../personas/schemas/persona.schema';
import {
  PUBLIC_ROUTE,
  INCOMPLETE_PROFILE,
  FIREBASE_ONLY,
} from './auth.decorators';
import { jest } from '@jest/globals';
import {
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import type { AuthService } from './auth.service';
import type { FirebaseAuthGuard } from './firebase-auth.guard';
import type { FirebaseIdentity, FirebaseRequest } from './firebase-identity';

let Guard: typeof import('./firebase-auth.guard').FirebaseAuthGuard;
jest.unstable_mockModule('firebase-admin/auth', () => ({ getAuth: jest.fn() }));
beforeAll(async () => {
  const modulePath = './firebase-auth.guard';
  const loaded = (await import(
    modulePath
  )) as typeof import('./firebase-auth.guard');
  Guard = loaded.FirebaseAuthGuard;
});

describe('FirebaseAuthGuard', () => {
  const verifyToken = jest.fn<AuthService['verifyToken']>();
  let guard: FirebaseAuthGuard;
  const resolve = jest.fn<FirebasePersonaService['resolve']>();
  const persona = {
    _id: new Types.ObjectId(),
    perfilCompleto: true,
  } as PersonaDocument;
  function prepare(authorization?: string | string[]) {
    const request = {
      headers: { authorization, 'x-usuario-id': 'id-provisional' },
    } as unknown as FirebaseRequest;
    const handler = () => {};
    const context = {
      getType: () => 'http',
      getHandler: () => handler,
      getClass: () => class TestController {},
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
    return { request, context, handler };
  }

  beforeEach(() => {
    verifyToken.mockReset();
    resolve.mockReset().mockResolvedValue(persona);
    guard = new Guard(
      { verifyToken } as unknown as AuthService,
      { resolve } as unknown as FirebasePersonaService,
      new Reflector(),
    );
  });

  it.each([
    undefined,
    '',
    'Basic abc',
    'Bearer',
    'Bearer ',
    'Bearer a b',
    'Bearer a,b',
    ['Bearer abc'],
  ])(
    'rechaza una cabecera ausente o mal formada, sin usar x-usuario-id: %p',
    async (header) => {
      const { context } = prepare(header);
      await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(verifyToken).not.toHaveBeenCalled();
    },
  );

  it.each(['Bearer', 'bearer', 'BEARER'])(
    'valida %s y adjunta solo la identidad',
    async (scheme) => {
      const identity: FirebaseIdentity = {
        uid: 'uid-prueba',
        email: null,
        name: null,
        emailVerified: false,
        provider: 'google.com',
      };
      verifyToken.mockResolvedValue(identity);
      const { request, context } = prepare(scheme + ' token-simulado');
      await expect(guard.canActivate(context)).resolves.toBe(true);
      expect(verifyToken).toHaveBeenCalledWith('token-simulado');
      expect(request.firebaseIdentity).toEqual(identity);
    },
  );

  it('no permite acceso ni fallback si el verificador rechaza el token', async () => {
    verifyToken.mockRejectedValue(new UnauthorizedException('Token inválido'));
    const { request, context } = prepare('Bearer invalido');
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(request.firebaseIdentity).toBeUndefined();
  });
  it('solo omite Firebase en una ruta marcada pública', async () => {
    const { context, handler } = prepare();
    Reflect.defineMetadata(PUBLIC_ROUTE, true, handler);
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(verifyToken).not.toHaveBeenCalled();
    expect(resolve).not.toHaveBeenCalled();
  });

  it('bloquea operaciones de un perfil incompleto', async () => {
    verifyToken.mockResolvedValue({ uid: 'uid' } as FirebaseIdentity);
    resolve.mockResolvedValue({
      ...persona,
      perfilCompleto: false,
    } as PersonaDocument);
    const { context } = prepare('Bearer token-simulado');
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('permite completar el perfil con identidad verificada', async () => {
    verifyToken.mockResolvedValue({ uid: 'uid' } as FirebaseIdentity);
    resolve.mockResolvedValue({
      ...persona,
      perfilCompleto: false,
    } as PersonaDocument);
    const { context, handler, request } = prepare('Bearer token-simulado');
    Reflect.defineMetadata(INCOMPLETE_PROFILE, true, handler);
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.persona?.perfilCompleto).toBe(false);
  });

  it('auth/me valida Firebase sin crear una Persona', async () => {
    verifyToken.mockResolvedValue({ uid: 'uid' } as FirebaseIdentity);
    const { context, handler } = prepare('Bearer token-simulado');
    Reflect.defineMetadata(FIREBASE_ONLY, true, handler);
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(resolve).not.toHaveBeenCalled();
  });
});
