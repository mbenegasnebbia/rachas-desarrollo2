import { Injectable, UnauthorizedException } from '@nestjs/common';
import { FirebaseAdminProvider } from './firebase-admin.provider';
import type { FirebaseIdentity } from './firebase-identity';

@Injectable()
export class AuthService {
  constructor(private readonly admin: FirebaseAdminProvider) {}

  async verifyToken(token: string): Promise<FirebaseIdentity> {
    if (!token?.trim())
      throw new UnauthorizedException('Token de autenticación requerido');
    const auth = this.admin.getAuth();
    try {
      const claims = await auth.verifyIdToken(token);
      return {
        uid: claims.uid,
        email: claims.email ?? null,
        emailVerified: claims.email_verified === true,
        name: typeof claims.name === 'string' ? claims.name : null,
        provider: claims.firebase?.sign_in_provider ?? null,
      };
    } catch {
      // Nunca propagar ni registrar el token o el error original del SDK.
      throw new UnauthorizedException(
        'Token de autenticación inválido o vencido',
      );
    }
  }
}
