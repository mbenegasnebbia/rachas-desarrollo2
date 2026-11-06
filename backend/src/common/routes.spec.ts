import 'reflect-metadata';
import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { PersonasController } from '../personas/personas.controller';
import { DesafiosController } from '../desafios/desafios.controller';
import { CheckinsController } from '../checkins/checkins.controller';

describe('Rutas de Parte II (metadata, sin servidor ni base)', () => {
  it.each([
    [PersonasController, 'personas'],
    [DesafiosController, 'desafios'],
    [CheckinsController, 'desafios/:desafioId/checkins'],
  ] as const)('mantiene el prefijo de %p', (controller, prefix) => {
    expect(Reflect.getMetadata(PATH_METADATA, controller)).toBe(prefix);
  });

  it.each([
    [PersonasController.prototype, 'create', RequestMethod.POST, '/'],
    [PersonasController.prototype, 'findAll', RequestMethod.GET, '/'],
    [PersonasController.prototype, 'findOne', RequestMethod.GET, ':id'],
    [PersonasController.prototype, 'update', RequestMethod.PATCH, ':id'],
    [
      PersonasController.prototype,
      'findDesafios',
      RequestMethod.GET,
      ':id/desafios',
    ],
    [DesafiosController.prototype, 'create', RequestMethod.POST, '/'],
    [DesafiosController.prototype, 'findAll', RequestMethod.GET, '/'],
    [DesafiosController.prototype, 'findOne', RequestMethod.GET, ':id'],
    [DesafiosController.prototype, 'update', RequestMethod.PATCH, ':id'],
    [
      DesafiosController.prototype,
      'cancel',
      RequestMethod.PATCH,
      ':id/cancelar',
    ],
    [
      DesafiosController.prototype,
      'join',
      RequestMethod.POST,
      'unirse/:codigo',
    ],
    [
      DesafiosController.prototype,
      'leave',
      RequestMethod.POST,
      ':id/abandonar',
    ],
    [
      DesafiosController.prototype,
      'findParticipantes',
      RequestMethod.GET,
      ':id/participantes',
    ],
    [CheckinsController.prototype, 'create', RequestMethod.POST, '/'],
    [CheckinsController.prototype, 'undo', RequestMethod.DELETE, 'ultimo'],
    [CheckinsController.prototype, 'findByPersona', RequestMethod.GET, '/'],
  ] as const)(
    'conserva método y ruta de %p.%s',
    (prototype, name, method, route) => {
      const handler = Object.getOwnPropertyDescriptor(prototype, name)
        ?.value as object;
      expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(method);
      expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe(route);
    },
  );
});
