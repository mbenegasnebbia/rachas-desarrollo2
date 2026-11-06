import { jest } from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import type { Model } from 'mongoose';
import { SeedService } from './seed.service';
import type { Persona } from '../personas/schemas/persona.schema';
import type { Desafio } from '../desafios/schemas/desafio.schema';

describe('Seed deshabilitado', () => {
  it.each([undefined, 'false', '0', 'TRUE', 'true '])(
    'no consulta ni escribe modelos con SEED_ENABLED=%p',
    async (flag) => {
      const personas = { updateOne: jest.fn(), findOne: jest.fn() };
      const desafios = { updateOne: jest.fn() };
      const config = new ConfigService({ SEED_ENABLED: flag });
      jest.spyOn(config, 'get').mockReturnValue(flag);
      const seed = new SeedService(
        personas as unknown as Model<Persona>,
        desafios as unknown as Model<Desafio>,
        config,
      );
      await seed.onApplicationBootstrap();
      expect(personas.updateOne).not.toHaveBeenCalled();
      expect(personas.findOne).not.toHaveBeenCalled();
      expect(desafios.updateOne).not.toHaveBeenCalled();
    },
  );
});
