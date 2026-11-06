import { Injectable, UnauthorizedException } from '@nestjs/common';
import { FirebaseAdminProvider } from './firebase-admin.provider';
import type { DecodedIdToken } from 'firebase-admin/auth';
import type { FirebaseIdentity } from './firebase-identity';

@Injectable()
export class AuthService {
  constructor(private readonly admin: FirebaseAdminProvider) {}

  private async claims(token: string): Promise<DecodedIdToken> {
    if (!token?.trim())
      throw new UnauthorizedException('Token de autenticación requerido');
    const auth = this.admin.getAuth();
    try {
      return await auth.verifyIdToken(token);
    } catch {
      throw new UnauthorizedException(
        'Token de autenticación inválido o vencido',
      );
    }
  }

  private identity(claims: DecodedIdToken): FirebaseIdentity {
    return {
      uid: claims.uid,
      email: claims.email ?? null,
      emailVerified: claims.email_verified === true,
      name: typeof claims.name === 'string' ? claims.name : null,
      provider: claims.firebase?.sign_in_provider ?? null,
    };
  }

  async verifyToken(token: string): Promise<FirebaseIdentity> {
    return this.identity(await this.claims(token));
  }

  async verifySocketToken(
    token: string,
  ): Promise<{ identity: FirebaseIdentity; expiresAt: number }> {
    const claims = await this.claims(token);
    const expiresAt = claims.exp * 1000;
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now())
      throw new UnauthorizedException(
        'Token de autenticación inválido o vencido',
      );
    return { identity: this.identity(claims), expiresAt };
  }
}
