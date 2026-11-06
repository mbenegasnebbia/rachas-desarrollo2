import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomUUID } from 'node:crypto';
import { AuthService } from '../auth/auth.service';
import { FirebasePersonaService } from '../auth/firebase-persona.service';
import { Desafio } from '../desafios/schemas/desafio.schema';
import { estadoDe } from '../common/calendario';
import { AlientoLimiter } from './aliento-limiter.service';
import { challengePayload, SocketAccessError } from './socket-policy';

export interface SocketIdentity {
  uid: string;
  personaId: string;
  expiresAt: number;
}
export interface SocketState extends SocketIdentity {
  desafioId?: string;
  subscriptionVersion?: number;
  expiration?: ReturnType<typeof setTimeout>;
}
export interface CheerEvent {
  id: string;
  desafioId: string;
  emoji: string;
  personaId: string;
  nombre: string;
  fecha: string;
}

@Injectable()
export class SocketAccessService {
  constructor(
    private readonly auth: AuthService,
    private readonly profiles: FirebasePersonaService,
    @InjectModel(Desafio.name) private readonly challenges: Model<Desafio>,
    private readonly limiter: AlientoLimiter,
  ) {}

  async authenticate(payload: unknown): Promise<SocketIdentity> {
    if (
      typeof payload !== 'object' ||
      payload === null ||
      !('token' in payload) ||
      typeof payload.token !== 'string' ||
      !payload.token
    )
      throw new SocketAccessError(
        'AUTH_REQUIRED',
        'Ingresá con Google para conectar',
      );
    try {
      const { identity, expiresAt } = await this.auth.verifySocketToken(
        payload.token,
      );
      const persona = await this.profiles.findExisting(identity.uid);
      if (!persona?.perfilCompleto)
        throw new SocketAccessError(
          'PROFILE_REQUIRED',
          'Completá tu perfil para conectar',
        );
      return {
        uid: identity.uid,
        personaId: persona._id.toString(),
        expiresAt,
      };
    } catch (error) {
      if (error instanceof SocketAccessError) throw error;
      throw new SocketAccessError(
        'AUTH_REQUIRED',
        'La sesión del socket no es válida',
      );
    }
  }

  assertLive(state: SocketIdentity): void {
    if (
      !state.uid ||
      !state.personaId ||
      !Number.isFinite(state.expiresAt) ||
      state.expiresAt <= Date.now()
    )
      throw new SocketAccessError(
        'AUTH_REQUIRED',
        'La sesión del socket venció',
      );
  }

  async challenge(id: string, allowClosed = false) {
    if (!Types.ObjectId.isValid(id))
      throw new SocketAccessError('INVALID_PAYLOAD', 'Desafío inválido');
    const challenge = await this.challenges.findById(id);
    if (!challenge)
      throw new SocketAccessError('NOT_FOUND', 'Desafío no encontrado');
    if (!allowClosed && !['PROGRAMADO', 'ACTIVO'].includes(estadoDe(challenge)))
      throw new SocketAccessError('STATE_CLOSED', 'El desafío está cerrado');
    return challenge;
  }

  async authorize(id: string, state: SocketIdentity) {
    this.assertLive(state);
    const challenge = await this.challenge(id);
    if (
      !challenge.participantes.some((id) => id.toString() === state.personaId)
    )
      throw new SocketAccessError('FORBIDDEN', 'No participás en este desafío');
    return challenge;
  }

  async cheer(body: unknown, state: SocketState): Promise<CheerEvent> {
    const { desafioId, emoji } = challengePayload(body, true);
    if (state.desafioId !== desafioId)
      throw new SocketAccessError('FORBIDDEN', 'Primero suscribite al desafío');
    const challenge = await this.authorize(desafioId, state);
    if (estadoDe(challenge) !== 'ACTIVO')
      throw new SocketAccessError(
        'STATE_CLOSED',
        'Solo podés alentar en desafíos activos',
      );
    if (challenge.participantes.length < 2)
      throw new SocketAccessError(
        'NO_RECIPIENTS',
        'Se necesita otro participante para alentar',
      );
    const persona = await this.profiles.findExisting(state.uid);
    if (!persona?.perfilCompleto || persona._id.toString() !== state.personaId)
      throw new SocketAccessError(
        'AUTH_REQUIRED',
        'La persona ya no está disponible',
      );
    this.assertLive(state);
    this.limiter.reserve(state.personaId, desafioId);
    return {
      id: randomUUID(),
      desafioId,
      emoji: emoji!,
      personaId: state.personaId,
      nombre: persona.nombre,
      fecha: new Date().toISOString(),
    };
  }
}
