import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  HttpException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, type ClientSession } from 'mongoose';
import { randomBytes } from 'crypto';

import { Desafio } from './schemas/desafio.schema';
import { Persona } from '../personas/schemas/persona.schema';
import { CreateDesafioDto } from './dto/create-desafio.dto';
import { UpdateDesafioDto } from './dto/update-desafio.dto';

import { PaginacionDto } from '../common/paginacion.dto';
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

    const valor = (tipo: string) =>
      partes.find((parte) => parte.type === tipo)!.value;
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
      throw new BadRequestException(
        'La fecha de fin debe ser posterior al inicio',
      );
    }

    const duracion =
      Math.round((fin.getTime() - inicio.getTime()) / 86400000) + 1;
    if (duracion < 3 || duracion > 90) {
      throw new BadRequestException('El desafío debe durar entre 3 y 90 días');
    }
  }

  async create(datos: CreateDesafioDto, usuarioId: string) {
    if (!usuarioId || !Types.ObjectId.isValid(usuarioId)) {
      throw new BadRequestException('ID de usuario inválido');
    }

    const inicio = new Date(datos.fechaInicio);
    const fin = new Date(datos.fechaFin);
    this.validarDuracion(inicio, fin);

    const hoy = this.obtenerHoy();
    if (this.fechaCalendario(inicio) < hoy) {
      throw new BadRequestException(
        'La fecha de inicio no puede estar en el pasado',
      );
    }

    return this.transaccion(async (session) => {
      const persona = await this.bloquearPersona(usuarioId, session);
      await this.validarLimite(persona._id, session);

      let codigoInvitacion: string;
      let existe: boolean;
      do {
        codigoInvitacion = randomBytes(3).toString('hex').toUpperCase();
        const desafioExistente = await this.desafioModel
          .findOne({
            codigoInvitacion,
          })
          .session(session);
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
        return await desafio.save({ session });
      } catch (error: unknown) {
        if (
          error &&
          typeof error === 'object' &&
          'code' in error &&
          error.code === 11000
        ) {
          throw new ConflictException('El código de invitación ya existe');
        }
        throw error;
      }
    });
  }

  async findAll(
    estado?: string,
    categoria?: string,
    paginacion = new PaginacionDto(),
    creador?: string,
  ) {
    if (
      estado &&
      !['PROGRAMADO', 'ACTIVO', 'FINALIZADO', 'CANCELADO', 'PAUSADO'].includes(
        estado,
      )
    )
      throw new BadRequestException('Estado inválido');
    if (
      categoria &&
      !['SALUD', 'ESTUDIO', 'FINANZAS', 'BIENESTAR', 'OTRO'].includes(categoria)
    )
      throw new BadRequestException('Categoría inválida');
    // PAUSADO is part of the v2 vocabulary. No pause transition exists yet,
    // so there are no persisted paused challenges to include.
    if (estado === 'PAUSADO') {
      return {
        items: [],
        total: 0,
        pagina: paginacion.pagina,
        limite: paginacion.limite,
        paginas: 0,
      };
    }
    const hoy = new Date(this.obtenerHoy() + 'T00:00:00Z');
    const manana = new Date(hoy.getTime() + 86400000);
    const filtro: Record<string, unknown> = categoria ? { categoria } : {};
    if (creador) filtro.creador = new Types.ObjectId(creador);
    if (estado) {
      filtro.cancelado = estado === 'CANCELADO';
      if (estado === 'PROGRAMADO') filtro.fechaInicio = { $gte: manana };
      if (estado === 'ACTIVO') {
        filtro.fechaInicio = { $lt: manana };
        filtro.fechaFin = { $gte: hoy };
      }
      if (estado === 'FINALIZADO') filtro.fechaFin = { $lt: hoy };
    }
    const { pagina, limite } = paginacion;
    const [items, total] = await Promise.all([
      this.desafioModel
        .find(filtro)
        .sort({ _id: -1 })
        .skip((pagina - 1) * limite)
        .limit(limite),
      this.desafioModel.countDocuments(filtro),
    ]);
    return { items, total, pagina, limite, paginas: Math.ceil(total / limite) };
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
    if (
      !Types.ObjectId.isValid(id) ||
      !usuarioId ||
      !Types.ObjectId.isValid(usuarioId)
    ) {
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
      throw new ForbiddenException(
        'Solo el creador puede modificar el desafío',
      );
    }

    const hoy = this.obtenerHoy();
    const inicioActual = this.fechaCalendario(desafio.fechaInicio);
    const finActual = this.fechaCalendario(desafio.fechaFin);

    if (desafio.cancelado || hoy > finActual) {
      throw new ConflictException(
        'No se puede modificar un desafío finalizado o cancelado',
      );
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
      const inicio =
        datos.fechaInicio !== undefined
          ? new Date(datos.fechaInicio)
          : desafio.fechaInicio;
      const fin =
        datos.fechaFin !== undefined
          ? new Date(datos.fechaFin)
          : desafio.fechaFin;

      this.validarDuracion(inicio, fin);

      if (this.fechaCalendario(inicio) < hoy) {
        throw new BadRequestException(
          'La fecha de inicio no puede estar en el pasado',
        );
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

    const cambios: Record<string, unknown> = { ...datos };
    if (datos.fechaInicio !== undefined)
      cambios.fechaInicio = new Date(datos.fechaInicio);
    if (datos.fechaFin !== undefined)
      cambios.fechaFin = new Date(datos.fechaFin);
    const actualizado = await this.desafioModel.findOneAndUpdate(
      {
        _id: id,
        cancelado: false,
        fechaInicio: desafio.fechaInicio,
        fechaFin: desafio.fechaFin,
        ...(cambiaConfiguracion
          ? {
              $expr: {
                $lte: [
                  { $size: '$participantes' },
                  datos.maxParticipantes ?? desafio.maxParticipantes,
                ],
              },
            }
          : {}),
      },
      { $set: cambios },
      { new: true, runValidators: true },
    );
    if (!actualizado)
      throw new ConflictException(
        'El desafio cambio; consulta los datos y reintenta',
      );
    return actualizado;
  }

  async cancel(id: string, usuarioId: string) {
    if (
      !Types.ObjectId.isValid(id) ||
      !usuarioId ||
      !Types.ObjectId.isValid(usuarioId)
    ) {
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

    if (
      desafio.cancelado ||
      this.obtenerHoy() > this.fechaCalendario(desafio.fechaFin)
    ) {
      throw new ConflictException(
        'No se puede cancelar un desafío finalizado o cancelado',
      );
    }

    desafio.cancelado = true;
    return await desafio.save();
  }

  async transaccion<T>(
    operacion: (session: ClientSession) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.desafioModel.db.transaction(operacion, {
        readConcern: { level: 'snapshot' },
        writeConcern: { w: 'majority' },
        readPreference: 'primary',
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) throw error;
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 11000
      )
        throw error;
      throw new ServiceUnavailableException(
        'No se pudo confirmar la operacion. Reintenta de forma segura.',
      );
    }
  }

  async bloquearPersona(usuarioId: string, session: ClientSession) {
    if (!Types.ObjectId.isValid(usuarioId))
      throw new BadRequestException('ID de usuario invalido');
    const persona = await this.personaModel.findOneAndUpdate(
      { _id: usuarioId },
      { $inc: { participacionVersion: 1 } },
      { new: true, session },
    );
    if (!persona) throw new NotFoundException('Persona no encontrada');
    return persona;
  }

  async validarLimite(personaId: Types.ObjectId, session: ClientSession) {
    const cantidad = await this.desafioModel
      .countDocuments({
        participantes: personaId,
        cancelado: false,
        fechaFin: { $gte: new Date(this.obtenerHoy() + 'T00:00:00Z') },
      })
      .session(session);
    if (cantidad >= 5)
      throw new ConflictException('Ya participas en 5 desafios vigentes');
  }

  async incorporarParticipante(
    id: string,
    usuarioId: string,
    session: ClientSession,
  ) {
    const desafio = await this.desafioModel.findById(id).session(session);
    if (!desafio) throw new NotFoundException('Desafio no encontrado');
    this.validarIngreso(desafio, usuarioId);
    const incorporado = await this.desafioModel.findOneAndUpdate(
      {
        _id: id,
        cancelado: false,
        fechaFin: { $gte: new Date(this.obtenerHoy() + 'T00:00:00Z') },
        participantes: { $ne: new Types.ObjectId(usuarioId) },
        exParticipantes: { $ne: new Types.ObjectId(usuarioId) },
        $expr: { $lt: [{ $size: '$participantes' }, '$maxParticipantes'] },
      },
      { $addToSet: { participantes: new Types.ObjectId(usuarioId) } },
      { new: true, session },
    );
    if (!incorporado)
      throw new ConflictException('El desafio ya no admite esta incorporacion');
    return incorporado;
  }

  validarIngreso(desafio: Desafio, usuarioId: string) {
    if (
      desafio.cancelado ||
      this.fechaCalendario(desafio.fechaFin) < this.obtenerHoy()
    )
      throw new ConflictException('El desafio esta finalizado o cancelado');
    if (desafio.creador.toString() === usuarioId)
      throw new ConflictException('El creador no puede solicitar acceso');
    if (desafio.participantes.some((id) => id.toString() === usuarioId))
      throw new ConflictException('Ya participas en este desafio');
    if (desafio.exParticipantes.some((id) => id.toString() === usuarioId))
      throw new ConflictException(
        'No podes volver a un desafio que abandonaste',
      );
    if (desafio.participantes.length >= desafio.maxParticipantes)
      throw new ConflictException('El desafio ya esta completo');
  }

  async leave(id: string, usuarioId: string) {
    if (
      !Types.ObjectId.isValid(id) ||
      !usuarioId ||
      !Types.ObjectId.isValid(usuarioId)
    ) {
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
      throw new ForbiddenException(
        'El creador no puede abandonar su propio desafío',
      );
    }

    if (!desafio.participantes.some((id) => id.toString() === usuarioId)) {
      throw new ConflictException('No participás en este desafío');
    }

    if (
      desafio.cancelado ||
      this.obtenerHoy() > this.fechaCalendario(desafio.fechaFin)
    )
      throw new ConflictException(
        'No se puede abandonar un desafío finalizado o cancelado',
      );
    const actualizado = await this.desafioModel.findOneAndUpdate(
      {
        _id: id,
        participantes: persona._id,
        cancelado: false,
        fechaFin: { $gte: new Date(this.obtenerHoy() + 'T00:00:00Z') },
      },
      {
        $pull: { participantes: persona._id },
        $addToSet: { exParticipantes: persona._id },
      },
      { new: true },
    );
    if (!actualizado)
      throw new ConflictException('El desafio o la participacion cambiaron');
    return actualizado;
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
    const participantes = await this.personaModel
      .find({ _id: { $in: desafio.participantes } })
      .select('nombre alias');

    // Match the public-person contract; never serialize emails/profile settings.
    return participantes.map((p) => ({
      id: p._id.toString(),
      nombre: p.nombre,
      alias: p.alias,
    }));
  }
}
