import { jest } from '@jest/globals';
import {
  ConflictException,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { FirebasePersonaService } from './firebase-persona.service';
import { Persona, PersonaSchema } from '../personas/schemas/persona.schema';
import type { FirebaseIdentity } from './firebase-identity';
import { requireOwner } from './auth.decorators';

describe('FirebasePersonaService (modelos simulados, sin Atlas)', () => {
  const id = new Types.ObjectId();
  const identity: FirebaseIdentity = {
    uid: 'uid-google',
    email: 'google@example.invalid',
    emailVerified: true,
    name: 'Google',
    provider: 'google.com',
  };
  const profile = { _id: id, perfilCompleto: false, firebaseUid: identity.uid };
  const findOne = jest.fn<(...args: unknown[]) => Promise<unknown>>();
  const findOneAndUpdate = jest.fn<(...args: unknown[]) => Promise<unknown>>();
  const indexes = jest.fn<() => Promise<unknown[]>>();
  const model = {
    findOne,
    findOneAndUpdate,
    collection: { indexes },
  } as unknown as Model<Persona>;
  const service = new FirebasePersonaService(model);

  beforeEach(() => {
    findOne.mockReset().mockResolvedValue(null);
    findOneAndUpdate.mockReset().mockResolvedValue(profile);
    indexes.mockReset().mockResolvedValue([
      {
        key: { firebaseUid: 1 },
        unique: true,
        partialFilterExpression: { firebaseUid: { $type: 'string' } },
      },
    ]);
  });

  it('conserva el ObjectId y datos del perfil ya asociado', async () => {
    findOne.mockResolvedValue(profile);
    expect(await service.resolve(identity)).toBe(profile);
    expect(findOne).toHaveBeenCalledWith({ firebaseUid: identity.uid });
    expect(findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('hace upsert solo por UID y da de alta un perfil incompleto', async () => {
    await service.resolve(identity);
    expect(findOneAndUpdate).toHaveBeenCalledTimes(1);
    const [filter, update, options] = findOneAndUpdate.mock.calls[0];
    const insert = (
      update as {
        $setOnInsert: {
          firebaseUid: string;
          email: string;
          perfilCompleto: boolean;
          alias: string;
        };
      }
    ).$setOnInsert;
    expect(filter).toEqual({ firebaseUid: identity.uid });
    expect(insert.firebaseUid).toBe(identity.uid);
    expect(insert.email).toBe(identity.email);
    expect(insert.perfilCompleto).toBe(false);
    expect(insert.alias).toMatch(/^u_[a-f0-9]{16}$/);
    expect(options).toMatchObject({
      upsert: true,
      new: true,
      runValidators: true,
    });
  });

  it('falla antes de escribir si falta el índice único', async () => {
    indexes.mockResolvedValue([]);
    await expect(service.resolve(identity)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('reutiliza el ganador de un alta concurrente del mismo UID', async () => {
    findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(profile);
    findOneAndUpdate.mockRejectedValue({ code: 11000 });
    expect(await service.resolve(identity)).toBe(profile);
    expect(findOne).toHaveBeenNthCalledWith(2, { firebaseUid: identity.uid });
  });

  it('no vincula ni consulta un perfil histórico por email ante un conflicto', async () => {
    findOneAndUpdate.mockRejectedValue({ code: 11000 });
    await expect(service.resolve(identity)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(
      findOne.mock.calls.every(
        ([filter]) =>
          JSON.stringify(filter) ===
          JSON.stringify({ firebaseUid: identity.uid }),
      ),
    ).toBe(true);
  });

  it('no crea perfiles con email sin verificar', async () => {
    await expect(
      service.resolve({ ...identity, emailVerified: false }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('completa únicamente el perfil incompleto del UID autenticado', async () => {
    await service.complete(identity.uid, { alias: 'alias_libre' });
    expect(findOneAndUpdate).toHaveBeenCalledWith(
      { firebaseUid: identity.uid, perfilCompleto: false },
      { $set: { alias: 'alias_libre', perfilCompleto: true } },
      { new: true, runValidators: true },
    );
  });

  it('devuelve 409 ante alias duplicado', async () => {
    findOneAndUpdate.mockRejectedValue({ code: 11000 });
    await expect(
      service.complete(identity.uid, { alias: 'repetido' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('declara un índice parcial que no obliga a migrar los documentos históricos', () => {
    expect(PersonaSchema.indexes()).toContainEqual([
      { firebaseUid: 1 },
      expect.objectContaining({
        unique: true,
        partialFilterExpression: { firebaseUid: { $type: 'string' } },
      }),
    ]);
  });

  it('rechaza acceder o editar una persona distinta del titular', () => {
    expect(() => requireOwner('otra', id.toString())).toThrow(
      ForbiddenException,
    );
    expect(() => requireOwner(id.toString(), id.toString())).not.toThrow();
  });
});
