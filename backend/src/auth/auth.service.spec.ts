import { jest } from '@jest/globals';
import {
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Auth, DecodedIdToken } from 'firebase-admin/auth';
import type { AuthService } from './auth.service';
import type { FirebaseAdminProvider } from './firebase-admin.provider';

let Service: typeof import('./auth.service').AuthService;
jest.unstable_mockModule('firebase-admin/auth', () => ({ getAuth: jest.fn() }));
beforeAll(async () => {
  const modulePath = './auth.service';
  const loaded = (await import(modulePath)) as typeof import('./auth.service');
  Service = loaded.AuthService;
});

describe('AuthService', () => {
  const verifyIdToken = jest.fn<Auth['verifyIdToken']>();
  const getAuth = jest.fn<FirebaseAdminProvider['getAuth']>();
  let service: AuthService;

  beforeEach(() => {
    verifyIdToken.mockReset();
    getAuth.mockReset().mockReturnValue({ verifyIdToken } as unknown as Auth);
    service = new Service({ getAuth } as unknown as FirebaseAdminProvider);
  });

  it('devuelve solo identidad pública, sin token ni claims adicionales', async () => {
    verifyIdToken.mockResolvedValue({
      uid: 'uid-prueba',
      email: 'prueba@example.invalid',
      email_verified: true,
      name: 'Prueba',
      firebase: { sign_in_provider: 'google.com' },
      customClaim: 'dato-no-publico',
      token: 'secreto-simulado',
      exp: 12345,
    } as unknown as DecodedIdToken);
    await expect(service.verifyToken('token-simulado')).resolves.toEqual({
      uid: 'uid-prueba',
      email: 'prueba@example.invalid',
      emailVerified: true,
      name: 'Prueba',
      provider: 'google.com',
    });
    expect(verifyIdToken).toHaveBeenCalledWith('token-simulado');
  });

  it('tolera los campos opcionales ausentes', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'uid-prueba' } as DecodedIdToken);
    await expect(service.verifyToken('token-simulado')).resolves.toEqual({
      uid: 'uid-prueba',
      email: null,
      emailVerified: false,
      name: null,
      provider: null,
    });
  });

  it.each([
    'auth/id-token-expired',
    'auth/argument-error',
    'auth/invalid-id-token',
  ])('rechaza %s con 401 sin filtrar el error original', async (code) => {
    verifyIdToken.mockRejectedValue({ code, message: 'secreto-simulado' });
    const result = service.verifyToken('token-simulado');
    await expect(result).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(result).rejects.toMatchObject({
      message: 'Token de autenticación inválido o vencido',
    });
  });

  it.each(['', '   '])(
    'rechaza un token vacío sin inicializar Admin',
    async (token) => {
      await expect(service.verifyToken(token)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(getAuth).not.toHaveBeenCalled();
    },
  );

  it('mantiene 503 ante falta de configuración sin llamar al verificador', async () => {
    getAuth.mockImplementation(() => {
      throw new ServiceUnavailableException();
    });
    await expect(service.verifyToken('token-simulado')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(verifyIdToken).not.toHaveBeenCalled();
  });
});
