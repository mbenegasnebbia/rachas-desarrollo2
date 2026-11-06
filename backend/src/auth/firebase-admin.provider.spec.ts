import { jest } from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import type { App, AppOptions, Credential } from 'firebase-admin/app';
import type { Auth } from 'firebase-admin/auth';

const getApps = jest.fn<() => App[]>();
const initializeApp = jest.fn<(options: AppOptions, name: string) => App>();
const applicationDefault = jest.fn<() => Credential>();
const getAuth = jest.fn<(app: App) => Auth>();
jest.unstable_mockModule('firebase-admin/app', () => ({
  getApps,
  initializeApp,
  applicationDefault,
}));
jest.unstable_mockModule('firebase-admin/auth', () => ({ getAuth }));
let FirebaseAdminProvider: typeof import('./firebase-admin.provider').FirebaseAdminProvider;
beforeAll(async () => {
  const modulePath = './firebase-admin.provider';
  const loaded = (await import(
    modulePath
  )) as typeof import('./firebase-admin.provider');
  FirebaseAdminProvider = loaded.FirebaseAdminProvider;
});

describe('FirebaseAdminProvider', () => {
  const fakeAuth = {} as Auth;
  const fakeApp = {
    name: 'rachas-auth-backend',
    options: { projectId: 'proyecto-prueba' },
  } as App;

  beforeEach(() => {
    getApps.mockReset().mockReturnValue([]);
    initializeApp.mockReset().mockReturnValue(fakeApp);
    applicationDefault.mockReset().mockReturnValue({} as Credential);
    getAuth.mockReset().mockReturnValue(fakeAuth);
  });

  it('inicializa bajo demanda una única vez usando ADC y proyecto explícito', () => {
    const provider = new FirebaseAdminProvider(
      new ConfigService({ FIREBASE_PROJECT_ID: 'proyecto-prueba' }),
    );
    expect(initializeApp).not.toHaveBeenCalled();
    expect(provider.getAuth()).toBe(fakeAuth);
    expect(provider.getAuth()).toBe(fakeAuth);
    expect(initializeApp).toHaveBeenCalledTimes(1);
    expect(initializeApp).toHaveBeenCalledWith(
      { projectId: 'proyecto-prueba', credential: {} },
      'rachas-auth-backend',
    );
    expect(applicationDefault).toHaveBeenCalledTimes(1);
    expect(getAuth).toHaveBeenCalledTimes(1);
  });

  it('reutiliza una app registrada sin crear credenciales nuevas', () => {
    getApps.mockReturnValue([fakeApp]);
    const provider = new FirebaseAdminProvider(
      new ConfigService({ FIREBASE_PROJECT_ID: 'proyecto-prueba' }),
    );
    expect(provider.getAuth()).toBe(fakeAuth);
    expect(initializeApp).not.toHaveBeenCalled();
    expect(applicationDefault).not.toHaveBeenCalled();
  });

  it('rechaza falta de proyecto sin inicializar el SDK', () => {
    const provider = new FirebaseAdminProvider(
      new ConfigService({ FIREBASE_PROJECT_ID: '' }),
    );
    expect(() => provider.getAuth()).toThrow(ServiceUnavailableException);
    expect(initializeApp).not.toHaveBeenCalled();
  });

  it('rechaza una app existente de otro proyecto', () => {
    getApps.mockReturnValue([
      {
        name: 'rachas-auth-backend',
        options: { projectId: 'otro-proyecto' },
      },
    ]);
    const provider = new FirebaseAdminProvider(
      new ConfigService({ FIREBASE_PROJECT_ID: 'proyecto-prueba' }),
    );
    expect(() => provider.getAuth()).toThrow(ServiceUnavailableException);
    expect(getAuth).not.toHaveBeenCalled();
  });

  it('oculta errores de credenciales del SDK', () => {
    applicationDefault.mockImplementation(() => {
      throw new Error('ruta-y-credencial-simuladas');
    });
    const provider = new FirebaseAdminProvider(
      new ConfigService({ FIREBASE_PROJECT_ID: 'proyecto-prueba' }),
    );
    expect(() => provider.getAuth()).toThrow('Autenticación no disponible');
  });
});
