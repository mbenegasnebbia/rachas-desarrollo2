import {
  Injectable,
  ConflictException,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomBytes } from 'node:crypto';
import { Persona } from '../personas/schemas/persona.schema';
import type { PersonaDocument } from '../personas/schemas/persona.schema';
import type { FirebaseIdentity } from './firebase-identity';
import type { CompleteProfileDto } from './complete-profile.dto';

@Injectable()
export class FirebasePersonaService {
  constructor(
    @InjectModel(Persona.name) private readonly personas: Model<Persona>,
  ) {}

  async findExisting(uid: string): Promise<PersonaDocument | null> {
    return this.personas.findOne({ firebaseUid: uid });
  }

  private async requireUidIndex(): Promise<void> {
    try {
      const indexes = await this.personas.collection.indexes();
      const valid = indexes.some((index) => {
        const filter = index.partialFilterExpression as
          { firebaseUid?: { $type?: string } } | undefined;
        return (
          index.unique === true &&
          Object.keys(index.key).length === 1 &&
          index.key.firebaseUid === 1 &&
          filter?.firebaseUid?.$type === 'string'
        );
      });
      if (!valid) throw new Error('Índice ausente');
    } catch {
      throw new ServiceUnavailableException(
        'Falta provisionar el índice único parcial firebaseUid. No se creó ningún perfil.',
      );
    }
  }

  async resolve(identity: FirebaseIdentity): Promise<PersonaDocument> {
    const existing = await this.personas.findOne({ firebaseUid: identity.uid });
    if (existing) return existing;
    if (
      !identity.email ||
      !identity.emailVerified ||
      identity.provider !== 'google.com'
    )
      throw new ForbiddenException(
        'Se requiere una cuenta Google con email verificado',
      );
    await this.requireUidIndex();
    try {
      const persona = await this.personas.findOneAndUpdate(
        { firebaseUid: identity.uid },
        {
          $setOnInsert: {
            firebaseUid: identity.uid,
            nombre: identity.name?.trim() || 'Nueva persona',
            email: identity.email,
            // Alias interno válido y único mientras se completa el perfil.
            alias: 'u_' + randomBytes(8).toString('hex'),
            perfilCompleto: false,
            zonaHoraria: 'America/Argentina/Buenos_Aires',
          },
        },
        {
          new: true,
          upsert: true,
          runValidators: true,
          setDefaultsOnInsert: true,
        },
      );
      if (!persona)
        throw new ServiceUnavailableException('No se pudo crear el perfil');
      return persona;
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 11000
      ) {
        // Dos logins del mismo UID convergen al documento ganador.
        const winner = await this.personas.findOne({
          firebaseUid: identity.uid,
        });
        if (winner) return winner;
        throw new ConflictException(
          'El email o alias ya está registrado. No se vinculó ningún perfil existente; requiere revisión.',
        );
      }
      throw new ServiceUnavailableException(
        'No se pudo preparar tu perfil. Reintentá.',
      );
    }
  }

  async complete(
    uid: string,
    datos: CompleteProfileDto,
  ): Promise<PersonaDocument> {
    try {
      const persona = await this.personas.findOneAndUpdate(
        { firebaseUid: uid, perfilCompleto: false },
        {
          $set: {
            alias: datos.alias,
            perfilCompleto: true,
            ...(datos.nombre !== undefined ? { nombre: datos.nombre } : {}),
            ...(datos.zonaHoraria !== undefined
              ? { zonaHoraria: datos.zonaHoraria }
              : {}),
          },
        },
        { new: true, runValidators: true },
      );
      if (!persona)
        throw new ConflictException('El perfil ya está completo o no existe');
      return persona;
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 11000
      )
        throw new ConflictException('Ese alias ya está en uso');
      throw error;
    }
  }
}
