import { SolicitudesAccesoService } from './solicitudesAcceso.service';
import { RealtimeEventsService } from '../realtime/realtime-events.service';
import { Test, TestingModule } from '@nestjs/testing';
import { DesafiosController } from './desafios.controller';
import { DesafiosService } from './desafios.service';

describe('DesafiosController', () => {
  let controller: DesafiosController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DesafiosController],
      providers: [
        { provide: DesafiosService, useValue: {} },
        { provide: SolicitudesAccesoService, useValue: {} },
        { provide: RealtimeEventsService, useValue: { publish: () => {} } },
      ],
    }).compile();

    controller = module.get<DesafiosController>(DesafiosController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
