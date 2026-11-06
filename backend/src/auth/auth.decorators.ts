import {
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import type { FirebaseRequest } from './firebase-identity';

export const PUBLIC_ROUTE = 'rachas.public';
export const INCOMPLETE_PROFILE = 'rachas.incomplete-profile';
export const FIREBASE_ONLY = 'rachas.firebase-only';
export const Public = () => SetMetadata(PUBLIC_ROUTE, true);
export const AllowIncompleteProfile = () =>
  SetMetadata(INCOMPLETE_PROFILE, true);
export const FirebaseOnly = () => SetMetadata(FIREBASE_ONLY, true);

export const CurrentPersonaId = createParamDecorator(
  (_: unknown, context: ExecutionContext): string => {
    const persona = context
      .switchToHttp()
      .getRequest<FirebaseRequest>().persona;
    if (!persona) throw new UnauthorizedException('Persona no disponible');
    return persona._id.toString();
  },
);

export function requireOwner(requestedId: string, currentId: string): void {
  if (requestedId !== currentId)
    throw new ForbiddenException(
      'Solo podés acceder a tu propio perfil o historial',
    );
}
