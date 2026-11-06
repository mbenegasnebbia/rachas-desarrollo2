import type { FirebasePersonaService } from './firebase-persona.service';
import { jest } from '@jest/globals';
import { UnauthorizedException } from '@nestjs/common';
import type { AuthController } from './auth.controller';
import type { FirebaseRequest } from './firebase-identity';

let Controller: typeof import('./auth.controller').AuthController;
jest.unstable_mockModule('firebase-admin/auth', () => ({ getAuth: jest.fn() }));
beforeAll(async () => {
  const modulePath = './auth.controller';
  const loaded = (await import(
    modulePath
  )) as typeof import('./auth.controller');
  Controller = loaded.AuthController;
});

describe('AuthController', () => {
  let controller: AuthController;
  beforeEach(() => {
    controller = new Controller({} as FirebasePersonaService);
  });
  it('proyecta únicamente los campos permitidos', () => {
    const request = {
      firebaseIdentity: {
        uid: 'uid-prueba',
        email: null,
        name: null,
        emailVerified: false,
        provider: 'google.com',
        token: 'secreto-simulado',
        customClaim: 'privado',
      },
    } as unknown as FirebaseRequest;
    expect(controller.me(request)).toEqual({
      uid: 'uid-prueba',
      email: null,
      name: null,
      emailVerified: false,
      provider: 'google.com',
    });
  });

  it('rechaza una petición sin identidad', () => {
    expect(() => controller.me({} as FirebaseRequest)).toThrow(
      UnauthorizedException,
    );
  });
});
