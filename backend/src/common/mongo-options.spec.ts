import { jest } from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import { mongoOptions } from './mongo-options';

function configuration(values: Record<string, unknown>) {
  const config = new ConfigService(values);
  jest.spyOn(config, 'get').mockImplementation((key) => values[String(key)]);
  return config;
}

describe('Opciones de conexión MongoDB', () => {
  it.each([undefined, 'false', '0', 'TRUE'])(
    'no inicializa colecciones ni índices automáticamente con %p',
    (flag) => {
      expect(
        mongoOptions(
          configuration({
            MONGODB_URI: 'mongodb://example.invalid/prueba-sin-conexion',
            MONGODB_AUTO_INIT_ENABLED: flag,
          }),
        ),
      ).toEqual({
        uri: 'mongodb://example.invalid/prueba-sin-conexion',
        autoCreate: false,
        autoIndex: false,
      });
    },
  );

  it('habilita ambas opciones solo mediante opt-in explícito', () => {
    const options = mongoOptions(
      configuration({
        MONGODB_URI: 'mongodb://example.invalid/prueba-sin-conexion',
        MONGODB_AUTO_INIT_ENABLED: 'true',
      }),
    );
    expect(options.autoCreate).toBe(true);
    expect(options.autoIndex).toBe(true);
  });

  it('continúa exigiendo la URI sin imprimir su valor', () => {
    expect(() =>
      mongoOptions(configuration({ MONGODB_URI: undefined })),
    ).toThrow();
  });
});
