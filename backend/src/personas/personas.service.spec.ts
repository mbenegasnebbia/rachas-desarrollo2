import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { PersonasService } from './personas.service';

describe('PersonasService', () => {
  let service: PersonasService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PersonasService,
        { provide: getModelToken('Persona'), useValue: {} },
        { provide: getModelToken('Desafio'), useValue: {} },
      ],
    }).compile();

    service = module.get<PersonasService>(PersonasService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
