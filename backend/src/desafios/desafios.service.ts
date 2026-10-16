import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomBytes } from 'crypto';

import { Desafio } from './schemas/desafio.schema';
import { Persona } from '../personas/schemas/persona.schema';
import { CreateDesafioDto } from './dto/create-desafio.dto';
import { UpdateDesafioDto } from './dto/update-desafio.dto';

@Injectable()
export class DesafiosService {
  constructor(
    @InjectModel(Desafio.name)
    private desafioModel: Model<Desafio>,

    @InjectModel(Persona.name)
    private personaModel: Model<Persona>,
  ) {}

  // Devuelve el día calendario actual en Argentina: YYYY-MM-DD.
  private obtenerHoy(): string {
    const partes = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Argentina/Buenos_Aires',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());

    const valor = (tipo: string) => partes.find((parte) => parte.type === tipo)!.value;
    return `${valor('year')}-${valor('month')}-${valor('day')}`;
  }

  // Convierte los Date de MongoDB en fechas calendario comparables.
  private fechaCalendario(fecha: Date): string {
    return fecha.toISOString().slice(0, 10);
  }

  private validarDuracion(inicio: Date, fin: Date): void {
    if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime())) {
      throw new BadRequestException('Fecha inválida');
    }

    if (fin < inicio) {
      throw new BadRequestException('La fecha de fin debe ser posterior al inicio');
    }

    const duracion = Math.round((fin.getTime() - inicio.getTime()) / 86400000) + 1;
    if (duracion < 3 || duracion > 90) {
      throw new BadRequestException('El desafío debe durar entre 3 y 90 días');
    }
  }

  async create(datos: CreateDesafioDto, usuarioId: string) {
    if (!usuarioId || !Types.ObjectId.isValid(usuarioId)) {
      throw new BadRequestException('ID de usuario inválido');
    }

    const persona = await this.personaModel.findById(usuarioId);
    if (!persona) {
      throw new NotFoundException('Persona no encontrada');
    }

    const inicio = new Date(datos.fechaInicio);
    const fin = new Date(datos.fechaFin);
    this.validarDuracion(inicio, fin);

    const hoy = this.obtenerHoy();
    if (this.fechaCalendario(inicio) < hoy) {
      throw new BadRequestException('La fecha de inicio no puede estar en el pasado');
    }

    const hoyDate = new Date(`${hoy}T00:00:00.000Z`);
    const desafiosVigentes = await this.desafioModel.countDocuments({
      participantes: persona._id,
      cancelado: false,
      fechaFin: { $gte: hoyDate },
    });

    if (desafiosVigentes >= 5) {
      throw new ConflictException('La persona ya participa en 5 desafíos vigentes');
    }

    let codigoInvitacion: string;
    let existe: boolean;
    do {
      codigoInvitacion = randomBytes(3).toString('hex').toUpperCase();
      const desafioExistente = await this.desafioModel.findOne({ codigoInvitacion });
      existe = !!desafioExistente;
    } while (existe);

    const desafio = new this.desafioModel({
      ...datos,
      fechaInicio: inicio,
      fechaFin: fin,
      creador: persona._id,
      participantes: [persona._id],
      codigoInvitacion,
    });

    try {
      return await desafio.save();
    } catch (error: any) {
      if (error.code === 11000) {
        throw new ConflictException('El código de invitación ya existe');
      }
      throw error;
    }
  }

  async findAll(estado?: string, categoria?: string) {
    // Validar filtros
    const estadosValidos = [
      'PROGRAMADO',
      'ACTIVO',
      'FINALIZADO',
      'CANCELADO',
    ];

    const categoriasValidas = [
      'SALUD',
      'ESTUDIO',
      'FINANZAS',
      'BIENESTAR',
      'OTRO',
    ];

    if (estado && !estadosValidos.includes(estado)) {
      throw new BadRequestException('Estado inválido');
    }

    if (categoria && !categoriasValidas.includes(categoria)) {
      throw new BadRequestException('Categoría inválida');
    }

    // Buscar desafíos, filtrando por categoría si corresponde
    const filtro = categoria ? { categoria } : {};

    const desafios = await this.desafioModel.find(filtro);

    // Obtener la fecha actual
    const hoy = this.obtenerHoy();

    // Calcular el estado de cada desafío y aplicar el filtro
    return desafios.filter((desafio) => {
      const inicio = desafio.fechaInicio.toISOString().slice(0, 10);
      const fin = desafio.fechaFin.toISOString().slice(0, 10);

      let estadoActual: string;

      if (desafio.cancelado) {
        estadoActual = 'CANCELADO';
      } else if (hoy < inicio) {
        estadoActual = 'PROGRAMADO';
      } else if (hoy > fin) {
        estadoActual = 'FINALIZADO';
      } else {
        estadoActual = 'ACTIVO';
      }

      return !estado || estadoActual === estado;
    });
  }

  async findOne(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID de desafío inválido');
    }

    const desafio = await this.desafioModel.findById(id);
    if (!desafio) {
      throw new NotFoundException('Desafío no encontrado');
    }
    return desafio;
  }

  async update(id: string, datos: UpdateDesafioDto, usuarioId: string) {
    if (!Types.ObjectId.isValid(id) || !usuarioId || !Types.ObjectId.isValid(usuarioId)) {
      throw new BadRequestException('ID inválido');
    }

    const desafio = await this.desafioModel.findById(id);
    if (!desafio) {
      throw new NotFoundException('Desafío no encontrado');
    }

    const persona = await this.personaModel.findById(usuarioId);
    if (!persona) {
      throw new NotFoundException('Persona no encontrada');
    }

    if (desafio.creador.toString() !== usuarioId) {
      throw new ForbiddenException('Solo el creador puede modificar el desafío');
    }

    const hoy = this.obtenerHoy();
    const inicioActual = this.fechaCalendario(desafio.fechaInicio);
    const finActual = this.fechaCalendario(desafio.fechaFin);

    if (desafio.cancelado || hoy > finActual) {
      throw new ConflictException('No se puede modificar un desafío finalizado o cancelado');
    }

    const cambiaConfiguracion =
      datos.fechaInicio !== undefined ||
      datos.fechaFin !== undefined ||
      datos.maxParticipantes !== undefined;

    if (cambiaConfiguracion && hoy >= inicioActual) {
      throw new ConflictException(
        'Las fechas y los cupos solo pueden modificarse si el desafío está PROGRAMADO',
      );
    }

    // Solo validar las fechas cuando realmente se cambian.
    if (datos.fechaInicio !== undefined || datos.fechaFin !== undefined) {
      const inicio = datos.fechaInicio !== undefined
        ? new Date(datos.fechaInicio)
        : desafio.fechaInicio;
      const fin = datos.fechaFin !== undefined
        ? new Date(datos.fechaFin)
        : desafio.fechaFin;

      this.validarDuracion(inicio, fin);

      if (this.fechaCalendario(inicio) < hoy) {
        throw new BadRequestException('La fecha de inicio no puede estar en el pasado');
      }
    }

    if (
      datos.maxParticipantes !== undefined &&
      datos.maxParticipantes < desafio.participantes.length
    ) {
      throw new BadRequestException(
        'El máximo no puede ser menor a la cantidad de participantes',
      );
    }

    if (datos.nombre !== undefined) desafio.nombre = datos.nombre;
    if (datos.descripcion !== undefined) desafio.descripcion = datos.descripcion;
    if (datos.fechaInicio !== undefined) desafio.fechaInicio = new Date(datos.fechaInicio);
    if (datos.fechaFin !== undefined) desafio.fechaFin = new Date(datos.fechaFin);
    if (datos.maxParticipantes !== undefined) {
      desafio.maxParticipantes = datos.maxParticipantes;
    }

    return await desafio.save();
  }

  async cancel(id: string, usuarioId: string) {
    if (!Types.ObjectId.isValid(id) || !usuarioId || !Types.ObjectId.isValid(usuarioId)) {
      throw new BadRequestException('ID inválido');
    }

    const desafio = await this.desafioModel.findById(id);
    if (!desafio) {
      throw new NotFoundException('Desafío no encontrado');
    }

    const persona = await this.personaModel.findById(usuarioId);
    if (!persona) {
      throw new NotFoundException('Persona no encontrada');
    }

    if (desafio.creador.toString() !== usuarioId) {
      throw new ForbiddenException('Solo el creador puede cancelar el desafío');
    }

    if (desafio.cancelado || this.obtenerHoy() > this.fechaCalendario(desafio.fechaFin)) {
      throw new ConflictException('No se puede cancelar un desafío finalizado o cancelado');
    }

    desafio.cancelado = true;
    return await desafio.save();
  }

  async join(codigo: string, usuarioId: string) {
    if (!usuarioId || !Types.ObjectId.isValid(usuarioId)) {
      throw new BadRequestException('ID de usuario inválido');
    }

    const persona = await this.personaModel.findById(usuarioId);
    if (!persona) {
      throw new NotFoundException('Persona no encontrada');
    }

    const desafio = await this.desafioModel.findOne({ codigoInvitacion: codigo });
    if (!desafio) {
      throw new NotFoundException('Código de invitación no encontrado');
    }

    const hoy = this.obtenerHoy();
    if (desafio.cancelado || this.fechaCalendario(desafio.fechaFin) < hoy) {
      throw new ConflictException('No se puede ingresar a un desafío finalizado o cancelado');
    }

    if (desafio.participantes.some((id) => id.toString() === usuarioId)) {
      throw new ConflictException('Ya participás en este desafío');
    }

    if (desafio.exParticipantes.some((id) => id.toString() === usuarioId)) {
      throw new ConflictException('No podés volver a un desafío que abandonaste');
    }

    if (desafio.participantes.length >= desafio.maxParticipantes) {
      throw new ConflictException('El desafío ya está completo');
    }

    const hoyDate = new Date(`${hoy}T00:00:00.000Z`);
    const cantidad = await this.desafioModel.countDocuments({
      participantes: persona._id,
      cancelado: false,
      fechaFin: { $gte: hoyDate },
    });

    if (cantidad >= 5) {
      throw new ConflictException('Ya participás en 5 desafíos vigentes');
    }

    desafio.participantes.push(persona._id);
    return await desafio.save();
  }

  async leave(id: string, usuarioId: string) {
    if (!Types.ObjectId.isValid(id) || !usuarioId || !Types.ObjectId.isValid(usuarioId)) {
      throw new BadRequestException('ID inválido');
    }

    const desafio = await this.desafioModel.findById(id);
    if (!desafio) {
      throw new NotFoundException('Desafío no encontrado');
    }

    const persona = await this.personaModel.findById(usuarioId);
    if (!persona) {
      throw new NotFoundException('Persona no encontrada');
    }

    if (desafio.creador.toString() === usuarioId) {
      throw new ForbiddenException('El creador no puede abandonar su propio desafío');
    }

    if (!desafio.participantes.some((id) => id.toString() === usuarioId)) {
      throw new ConflictException('No participás en este desafío');
    }

    desafio.participantes = desafio.participantes.filter(
      (id) => id.toString() !== usuarioId,
    );
    desafio.exParticipantes.push(persona._id);

    return await desafio.save();
  }

  async findParticipantes(id: string) {
  // 1. Validar el ID
  if (!Types.ObjectId.isValid(id)) {
    throw new BadRequestException('ID de desafío inválido');
  }

  // 2. Buscar el desafío
  const desafio = await this.desafioModel.findById(id);

  if (!desafio) {
    throw new NotFoundException('Desafío no encontrado');
  }

  // 3. Buscar los datos de sus participantes
  const participantes = await this.personaModel.find({
    _id: { $in: desafio.participantes },
  });

  return participantes;
}
}
