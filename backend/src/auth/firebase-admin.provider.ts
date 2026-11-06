import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';

const APP_NAME = 'rachas-auth-backend';

@Injectable()
export class FirebaseAdminProvider {
  private auth?: Auth;

  constructor(private readonly config: ConfigService) {}

  getAuth(): Auth {
    if (this.auth) return this.auth;
    const projectId = this.config.get<string>('FIREBASE_PROJECT_ID')?.trim();
    if (!projectId)
      throw new ServiceUnavailableException('Autenticación no configurada');
    try {
      const existing = getApps().find((app) => app.name === APP_NAME);
      if (existing && existing.options.projectId !== projectId)
        throw new Error('Proyecto de autenticación incompatible');
      const app =
        existing ??
        initializeApp(
          { projectId, credential: applicationDefault() },
          APP_NAME,
        );
      this.auth = getAuth(app);
      return this.auth;
    } catch {
      // No devolver errores del SDK que puedan contener rutas o credenciales.
      throw new ServiceUnavailableException('Autenticación no disponible');
    }
  }
}
