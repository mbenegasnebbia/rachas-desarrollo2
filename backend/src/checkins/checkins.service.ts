import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';

import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { Checkin } from './schemas/checkin.schema';
import { Desafio } from '../desafios/schemas/desafio.schema';
import { Persona } from '../personas/schemas/persona.schema';
import { CreateCheckinDto } from './dto/create-checkin.dto';

@Injectable()
export class CheckinsService {
  constructor(
    @InjectModel(Checkin.name)
    private checkinModel: Model<Checkin>,

    @InjectModel(Desafio.name)
    private desafioModel: Model<Desafio>,

    @InjectModel(Persona.name)
    private personaModel: Model<Persona>,
  ) {}

  private obtenerHoy(zonaHoraria: string): string {
    const partes = new Intl.DateTimeFormat('en-US', {
      timeZone: zonaHoraria,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());

    const obtener = (tipo: string) =>
      partes.find((parte) => parte.type === tipo)!.value;

    return `${obtener('year')}-${obtener('month')}-${obtener('day')}`;
  }

  async create(
    desafioId: string,
    usuarioId: string,
    datos: CreateCheckinDto,
  ) {
    // 1. Validar los IDs
    if (
      !usuarioId ||
      !Types.ObjectId.isValid(usuarioId) ||
      !Types.ObjectId.isValid(desafioId)
    ) {
      throw new BadRequestException('ID inválido');
    }

    if (
      typeof datos.fecha !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(datos.fecha)
    ) {
      throw new BadRequestException(
        'La fecha debe tener formato YYYY-MM-DD',
      );
    }

    const fechaValidada = new Date(`${datos.fecha}T00:00:00Z`);

    if (
      Number.isNaN(fechaValidada.getTime()) ||
      fechaValidada.toISOString().slice(0, 10) !== datos.fecha
    ) {
      throw new BadRequestException('Fecha inválida');
    }

    // 2. Buscar persona y desafío
    const persona = await this.personaModel.findById(usuarioId);
    const desafio = await this.desafioModel.findById(desafioId);

    if (!persona || !desafio) {
      throw new NotFoundException('Persona o desafío no encontrado');
    }

    // 3. Verificar que participe
    const participa = desafio.participantes.some(
      (id) => id.toString() === usuarioId,
    );

    if (!participa) {
      throw new ForbiddenException(
        'No participás en este desafío',
      );
    }

    // 4. Obtener hoy y ayer en la zona horaria de la persona
// 4. Obtener hoy y ayer en la zona horaria de la persona
    const hoy = this.obtenerHoy(persona.zonaHoraria);

    const ayerFecha = new Date(`${hoy}T00:00:00Z`);
    ayerFecha.setUTCDate(ayerFecha.getUTCDate() - 1);
    const ayer = ayerFecha.toISOString().slice(0, 10);

    // 5. Verificar que el desafío esté ACTIVO
    const inicio = desafio.fechaInicio.toISOString().slice(0, 10);
    const fin = desafio.fechaFin.toISOString().slice(0, 10);

    if (desafio.cancelado || hoy < inicio || hoy > fin) {
      throw new ConflictException(
        'El desafío no está activo',
      );
    }

    // 6. Validar la fecha enviada
    if (datos.fecha !== hoy && datos.fecha !== ayer) {
      throw new BadRequestException(
        'Solo podés registrar un check-in de hoy o ayer',
      );
    }

    // Verificar que esté dentro del desafío
    if (datos.fecha < inicio || datos.fecha > fin) {
      throw new BadRequestException(
        'La fecha está fuera del período del desafío',
      );
    }

    // 7. Comprobar si ya existe un check-in
    const existente = await this.checkinModel.findOne({
      persona: persona._id,
      desafio: desafio._id,
      fecha: datos.fecha,
    });

    if (existente) {
      throw new ConflictException(
        'Ya registraste un check-in para ese día',
      );
    }

    // 8. Guardar
    try {
      const checkin = new this.checkinModel({
        persona: persona._id,
        desafio: desafio._id,
        ...datos,
      });

      return await checkin.save();
    } catch (error: any) {
      if (error.code === 11000) {
        throw new ConflictException(
          'Ya registraste un check-in para ese día',
        );
      }

      throw error;
    }
  }

  async undo(desafioId: string, usuarioId: string) {
  // 1. Validar los IDs
  if (
    !usuarioId ||
    !Types.ObjectId.isValid(usuarioId) ||
    !Types.ObjectId.isValid(desafioId)
  ) {
    throw new BadRequestException('ID inválido');
  }

  // 2. Buscar la persona
  const persona = await this.personaModel.findById(usuarioId);

  if (!persona) {
    throw new NotFoundException('Persona no encontrada');
  }

  // 3. Buscar el desafío
  const desafio = await this.desafioModel.findById(desafioId);

  if (!desafio) {
    throw new NotFoundException('Desafío no encontrado');
  }

  // 4. Obtener hoy según la zona horaria de la persona
  const hoy = this.obtenerHoy(persona.zonaHoraria);

  // 5. Buscar el último check-in propio en este desafío
  const ultimoCheckin = await this.checkinModel
    .findOne({
      persona: persona._id,
      desafio: desafio._id,
    })
    .sort({ fecha: -1 });

  if (!ultimoCheckin) {
    throw new NotFoundException('No tenés check-ins en este desafío');
  }

  // 6. Solo se puede deshacer si es de hoy
  if (ultimoCheckin.fecha !== hoy) {
    throw new ConflictException(
      'Solo podés deshacer tu último check-in si es de hoy',
    );
  }

  // 7. Eliminarlo
  await this.checkinModel.deleteOne({
    _id: ultimoCheckin._id,
  });

  return {
    mensaje: 'Check-in deshecho correctamente',
  };
}
  
  async findByPersona(desafioId: string, personaId: string) {
    // 1. Validar los IDs
    if (
      !desafioId ||
      !personaId ||
      !Types.ObjectId.isValid(desafioId) ||
      !Types.ObjectId.isValid(personaId)
    ) {
      throw new BadRequestException('ID inválido');
    }

    // 2. Comprobar que exista el desafío
    const desafio = await this.desafioModel.findById(desafioId);

    if (!desafio) {
      throw new NotFoundException('Desafío no encontrado');
    }

    // 3. Comprobar que exista la persona
    const persona = await this.personaModel.findById(personaId);

    if (!persona) {
      throw new NotFoundException('Persona no encontrada');
    }

    // 4. Buscar sus check-ins en ese desafío
    return await this.checkinModel
      .find({
        desafio: desafio._id,
        persona: persona._id,
      })
      .sort({ fecha: -1 });
  }
}