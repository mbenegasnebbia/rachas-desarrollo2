import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import type { RealtimeGateway } from './realtime.gateway';
import { RealtimeEventsService } from './realtime-events.service';

jest.unstable_mockModule('firebase-admin/auth', () => ({ getAuth: jest.fn() }));

describe('RealtimeModule (sin servidor ni conexión MongoDB)', () => {
  let fixture: TestingModule;
  let gatewayType: typeof import('./realtime.gateway').RealtimeGateway;
  beforeAll(async () => {
    const modulePath = './realtime.module';
    const gatewayPath = './realtime.gateway';
    const { RealtimeModule } = (await import(
      modulePath
    )) as typeof import('./realtime.module');
    gatewayType = (
      (await import(gatewayPath)) as typeof import('./realtime.gateway')
    ).RealtimeGateway;
    fixture = await Test.createTestingModule({ imports: [RealtimeModule] })
      .overrideProvider(getModelToken('Persona'))
      .useValue({})
      .overrideProvider(getModelToken('Desafio'))
      .useValue({})
      .compile();
  });
  afterAll(async () => {
    await fixture?.close();
  });
  it('resuelve gateway, autenticación, modelos simulados y bus singleton', () => {
    const gateway: RealtimeGateway = fixture.get(gatewayType);
    expect(gateway).toBeDefined();
    expect(fixture.get(RealtimeEventsService)).toBeDefined();
  });
});
