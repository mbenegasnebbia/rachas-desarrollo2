import { Test, TestingModule } from '@nestjs/testing';
import { PersonasController } from './personas.controller';
import { PersonasService } from './personas.service';

describe('PersonasController', () => {
  let controller: PersonasController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PersonasController],
      providers: [{ provide: PersonasService, useValue: {} }],
    }).compile();

    controller = module.get<PersonasController>(PersonasController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
