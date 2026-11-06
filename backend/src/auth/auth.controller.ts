import {
  Body,
  Controller,
  Get,
  Patch,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { AllowIncompleteProfile, FirebaseOnly } from './auth.decorators';
import { FirebasePersonaService } from './firebase-persona.service';
import { CompleteProfileDto } from './complete-profile.dto';
import type { FirebaseIdentity, FirebaseRequest } from './firebase-identity';

@Controller('auth')
export class AuthController {
  constructor(private readonly profiles: FirebasePersonaService) {}

  @Get('me')
  @FirebaseOnly()
  me(@Req() request: FirebaseRequest): FirebaseIdentity {
    const identity = request.firebaseIdentity;
    if (!identity) throw new UnauthorizedException('Identidad no disponible');
    return {
      uid: identity.uid,
      email: identity.email,
      emailVerified: identity.emailVerified,
      name: identity.name,
      provider: identity.provider,
    };
  }

  @Get('persona')
  @AllowIncompleteProfile()
  persona(@Req() request: FirebaseRequest) {
    if (!request.persona)
      throw new UnauthorizedException('Persona no disponible');
    return request.persona;
  }

  @Patch('perfil')
  @AllowIncompleteProfile()
  complete(@Req() request: FirebaseRequest, @Body() datos: CompleteProfileDto) {
    if (!request.firebaseIdentity) throw new UnauthorizedException();
    return this.profiles.complete(request.firebaseIdentity.uid, datos);
  }
}
