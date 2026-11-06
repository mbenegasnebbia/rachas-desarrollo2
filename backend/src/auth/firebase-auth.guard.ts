import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from './auth.service';
import { FirebasePersonaService } from './firebase-persona.service';
import {
  PUBLIC_ROUTE,
  INCOMPLETE_PROFILE,
  FIREBASE_ONLY,
} from './auth.decorators';
import type { FirebaseRequest } from './firebase-identity';

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly profiles: FirebasePersonaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Los sockets se autentican en el middleware del gateway y autorizan cada mensaje.
    if (context.getType() === 'ws') return true;
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE, targets))
      return true;
    const request = context.switchToHttp().getRequest<FirebaseRequest>();
    const authorization = request.headers.authorization;
    const match =
      typeof authorization === 'string'
        ? /^Bearer ([^\s,]+)$/i.exec(authorization)
        : null;
    if (!match)
      throw new UnauthorizedException('Se requiere Authorization: Bearer');
    request.firebaseIdentity = await this.auth.verifyToken(match[1]);
    if (this.reflector.getAllAndOverride<boolean>(FIREBASE_ONLY, targets))
      return true;
    request.persona = await this.profiles.resolve(request.firebaseIdentity);
    if (
      !request.persona.perfilCompleto &&
      !this.reflector.getAllAndOverride<boolean>(INCOMPLETE_PROFILE, targets)
    )
      throw new ForbiddenException('Completá tu alias antes de continuar');
    return true;
  }
}
