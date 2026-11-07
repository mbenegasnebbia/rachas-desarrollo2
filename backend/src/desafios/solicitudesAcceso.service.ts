import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Desafio } from './schemas/desafio.schema';
import { Persona } from '../personas/schemas/persona.schema';
import {
  SolicitudAcceso,
  type EstadoSolicitud,
} from './schemas/solicitudAcceso.schema';
import { DesafiosService } from './desafios.service';
import { PaginacionDto } from '../common/paginacion.dto';

type Solicitud = SolicitudAcceso & { _id: Types.ObjectId };
type Identidad = { _id: Types.ObjectId; nombre: string; alias: string };
type ResumenDesafio = {
  _id: Types.ObjectId;
  nombre: string;
  categoria: string;
};

@Injectable()
export class SolicitudesAccesoService {
  constructor(
    @InjectModel(SolicitudAcceso.name)
    private readonly solicitudes: Model<SolicitudAcceso>,
    @InjectModel(Desafio.name) private readonly desafios: Model<Desafio>,
    @InjectModel(Persona.name) private readonly personas: Model<Persona>,
    private readonly participacion: DesafiosService,
  ) {}

  private validarIds(...ids: string[]) {
    if (ids.some((id) => !Types.ObjectId.isValid(id)))
      throw new BadRequestException('ID invalido');
  }

  private async verificarIndice() {
    try {
      const indexes = await this.solicitudes.collection.indexes();
      if (
        !indexes.some(
          (i) =>
            Object.keys(i.key).length === 2 &&
            i.key.desafio === 1 &&
            i.key.solicitante === 1 &&
            i.unique === true &&
            !i.sparse &&
            !i.partialFilterExpression,
        )
      )
        throw new Error();
    } catch {
      throw new ServiceUnavailableException(
        'Solicitudes requiere el indice unico desafio/solicitante provisionado',
      );
    }
  }

  private vista(s: Solicitud, d?: ResumenDesafio, p?: Identidad) {
    return {
      id: s._id.toString(),
      desafio: {
        id: s.desafio.toString(),
        nombre: d?.nombre ?? null,
        categoria: d?.categoria ?? null,
      },
      solicitante: {
        id: s.solicitante.toString(),
        nombre: p?.nombre ?? null,
        alias: p?.alias ?? null,
      },
      estado: s.estado,
      solicitadaEn: s.solicitadaEn,
      resueltaEn: s.resueltaEn ?? null,
      resueltaPor: s.resueltaPor?.toString() ?? null,
    };
  }

  async solicitar(codigo: string, usuarioId: string) {
    this.validarIds(usuarioId);
    if (typeof codigo !== 'string' || !/^[A-Z0-9]{6}$/i.test(codigo))
      throw new BadRequestException('Codigo de invitacion invalido');
    await this.verificarIndice();
    try {
      return await this.participacion.transaccion(async (session) => {
        // Real challenge write coordinates requests with cancellation, capacity and approvals.
        const desafio = await this.desafios.findOneAndUpdate(
          { codigoInvitacion: codigo.toUpperCase() },
          { $inc: { solicitudesVersion: 1 } },
          { new: true, session },
        );
        if (!desafio)
          throw new NotFoundException('Codigo de invitacion no encontrado');
        const persona = await this.personas
          .findById(usuarioId)
          .session(session);
        if (!persona) throw new NotFoundException('Persona no encontrada');
        const existente = await this.solicitudes
          .findOne({
            desafio: desafio._id,
            solicitante: persona._id,
          })
          .session(session);
        // Repeated codes return the existing state even after resolution/closure.
        if (existente) return this.vista(existente, desafio, persona);
        this.participacion.validarIngreso(desafio, usuarioId);
        const [solicitud] = await this.solicitudes.create(
          [
            {
              desafio: desafio._id,
              solicitante: persona._id,
              estado: 'PENDING',
              solicitadaEn: new Date(),
              resueltaEn: null,
              resueltaPor: null,
            },
          ],
          { session },
        );
        return this.vista(solicitud, desafio, persona);
      });
    } catch (error: unknown) {
      if (
        !error ||
        typeof error !== 'object' ||
        !('code' in error) ||
        error.code !== 11000
      )
        throw error;
      // Concurrent insertion may be reported as E11000 rather than a transaction retry.
      const desafio = await this.desafios.findOne({
        codigoInvitacion: codigo.toUpperCase(),
      });
      const solicitud =
        desafio &&
        (await this.solicitudes.findOne({
          desafio: desafio._id,
          solicitante: usuarioId,
        }));
      if (!desafio || !solicitud)
        throw new ServiceUnavailableException(
          'Reintenta consultar tu solicitud',
        );
      const persona = await this.personas.findById(usuarioId);
      return this.vista(solicitud, desafio, persona ?? undefined);
    }
  }

  async creados(usuarioId: string, pagina: PaginacionDto) {
    this.validarIds(usuarioId);
    return this.participacion.findAll(undefined, undefined, pagina, usuarioId);
  }

  private async creador(desafioId: string, usuarioId: string) {
    this.validarIds(desafioId, usuarioId);
    // Scoped lookup does not reveal whether a foreign challenge exists.
    const desafio = await this.desafios.findOne({
      _id: desafioId,
      creador: usuarioId,
    });
    if (!desafio) throw new NotFoundException('Desafio propio no encontrado');
  }

  async pendientes(
    desafioId: string,
    usuarioId: string,
    pagina: PaginacionDto,
  ) {
    await this.creador(desafioId, usuarioId);
    return this.listar(
      { desafio: new Types.ObjectId(desafioId), estado: 'PENDING' },
      pagina,
    );
  }

  async propias(usuarioId: string, pagina: PaginacionDto) {
    this.validarIds(usuarioId);
    return this.listar({ solicitante: new Types.ObjectId(usuarioId) }, pagina);
  }

  private async listar(
    filtro: Record<string, unknown>,
    { pagina, limite }: PaginacionDto,
  ) {
    const [items, total] = await Promise.all([
      this.solicitudes
        .find(filtro)
        .sort({ _id: -1 })
        .skip((pagina - 1) * limite)
        .limit(limite),
      this.solicitudes.countDocuments(filtro),
    ]);
    const [desafios, personas] = await Promise.all([
      this.desafios
        .find({ _id: { $in: items.map((s) => s.desafio) } })
        .select('nombre categoria'),
      this.personas
        .find({ _id: { $in: items.map((s) => s.solicitante) } })
        .select('nombre alias'),
    ]);
    return {
      items: items.map((s) =>
        this.vista(
          s,
          desafios.find((d) => d._id.equals(s.desafio)),
          personas.find((p) => p._id.equals(s.solicitante)),
        ),
      ),
      total,
      pagina,
      limite,
      paginas: Math.ceil(total / limite),
    };
  }

  async resolver(
    desafioId: string,
    solicitudId: string,
    usuarioId: string,
    estado: 'APPROVED' | 'REJECTED',
  ) {
    this.validarIds(desafioId, solicitudId, usuarioId);
    return this.resolverPendiente(solicitudId, usuarioId, estado, desafioId);
  }

  async cancelar(solicitudId: string, usuarioId: string) {
    this.validarIds(solicitudId, usuarioId);
    return (await this.resolverPendiente(solicitudId, usuarioId, 'CANCELLED'))
      .solicitud;
  }

  private async resolverPendiente(
    solicitudId: string,
    usuarioId: string,
    estado: Exclude<EstadoSolicitud, 'PENDING'>,
    desafioId?: string,
  ) {
    return this.participacion.transaccion(async (session) => {
      const s = await this.solicitudes
        .findOne({
          _id: solicitudId,
          ...(desafioId ? { desafio: desafioId } : { solicitante: usuarioId }),
        })
        .session(session);
      if (!s) throw new NotFoundException('Solicitud no encontrada');
      const d = await this.desafios.findById(s.desafio).session(session);
      if (!d) throw new NotFoundException('Desafio no encontrado');
      if (estado !== 'CANCELLED' && d.creador.toString() !== usuarioId)
        throw new ForbiddenException(
          'Solo el creador puede resolver solicitudes',
        );
      const persona = await this.personas
        .findById(s.solicitante)
        .session(session);
      if (s.estado === estado)
        return {
          solicitud: this.vista(s, d, persona ?? undefined),
          incorporado: false,
        };
      if (s.estado !== 'PENDING')
        throw new ConflictException('La solicitud ya fue resuelta');
      if (estado === 'APPROVED') {
        const solicitante = await this.participacion.bloquearPersona(
          s.solicitante.toString(),
          session,
        );
        await this.participacion.validarLimite(solicitante._id, session);
        await this.participacion.incorporarParticipante(
          d._id.toString(),
          s.solicitante.toString(),
          session,
        );
      }
      const resuelta = await this.solicitudes.findOneAndUpdate(
        { _id: s._id, estado: 'PENDING' },
        {
          $set: {
            estado,
            resueltaEn: new Date(),
            resueltaPor: new Types.ObjectId(usuarioId),
          },
        },
        { new: true, session },
      );
      if (!resuelta)
        throw new ConflictException('La solicitud cambio; reintenta');
      return {
        solicitud: this.vista(resuelta, d, persona ?? undefined),
        incorporado: estado === 'APPROVED',
      };
    });
  }
}
