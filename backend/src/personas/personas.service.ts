import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { Persona } from './schemas/persona.schema';
import { CreatePersonaDto } from './dto/create-persona.dto';

import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { UpdatePersonaDto } from './dto/update-persona.dto';

import { Desafio } from '../desafios/schemas/desafio.schema';


@Injectable()
export class PersonasService {
  constructor(
    @InjectModel(Persona.name)
    private personaModel: Model<Persona>,
    @InjectModel(Desafio.name)
    private desafioModel: Model<Desafio>,
  ) {}

  // Crear una persona
  async create(datos: CreatePersonaDto) {
    try {
      const persona = new this.personaModel(datos);
      return await persona.save();
    } catch (error: any) {
      if (error.code === 11000) {
        throw new ConflictException('El alias o email ya existe');
      }
      throw error;
    }
  }

  // Obtener todas las personas
  async findAll() {
    return await this.personaModel.find();
  }

  // Obtener una persona por ID
async findOne(id: string) {
  if (!Types.ObjectId.isValid(id)) {
    throw new BadRequestException('ID inválido');
  }

  const persona = await this.personaModel.findById(id);

  if (!persona) {
    throw new NotFoundException('Persona no encontrada');
  }
  
  return persona;
}

  async update(id: string, datos: UpdatePersonaDto) {
  if (!Types.ObjectId.isValid(id)) {
    throw new BadRequestException('ID inválido');
  }

  const persona = await this.personaModel.findByIdAndUpdate(
    id,
    datos,
    { new: true, runValidators: true },
  );

  if (!persona) {
    throw new NotFoundException('Persona no encontrada');
  }

  return persona;
}

async findDesafios(id: string) {
  // 1. Validar el ID
  if (!Types.ObjectId.isValid(id)) {
    throw new BadRequestException('ID de persona inválido');
  }

  // 2. Comprobar que la persona exista
  const persona = await this.personaModel.findById(id);

  if (!persona) {
    throw new NotFoundException('Persona no encontrada');
  }

  // 3. Buscar los desafíos donde participa
  return await this.desafioModel.find({
    participantes: persona._id,
  });
}
}

