import { SolicitudesAccesoService } from './solicitudesAcceso.service';
import { RealtimeEventsService } from '../realtime/realtime-events.service';
import { CurrentPersonaId } from '../auth/auth.decorators';
import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  GoneException,
} from '@nestjs/common';

import { ListarDesafiosDto } from './dto/listar-desafios.dto';
import { DesafiosService } from './desafios.service';
import { CreateDesafioDto } from './dto/create-desafio.dto';
import { UpdateDesafioDto } from './dto/update-desafio.dto';
import { Query } from '@nestjs/common';
import { PaginacionDto } from '../common/paginacion.dto';

@Controller('desafios')
export class DesafiosController {
  constructor(
    private desafiosService: DesafiosService,
    private readonly events: RealtimeEventsService,
    private readonly solicitudes: SolicitudesAccesoService,
  ) {}

  @Post()
  create(
    @Body() datos: CreateDesafioDto,
    @CurrentPersonaId() usuarioId: string,
  ) {
    return this.desafiosService.create(datos, usuarioId);
  }

  @Get()
  findAll(@Query() query: ListarDesafiosDto) {
    return this.desafiosService.findAll(query.estado, query.categoria, query);
  }

  @Get('creados')
  creados(
    @CurrentPersonaId() usuarioId: string,
    @Query() pagina: PaginacionDto,
  ) {
    return this.solicitudes.creados(usuarioId, pagina);
  }

  @Get(':id/solicitudes')
  pendientes(
    @Param('id') id: string,
    @CurrentPersonaId() usuarioId: string,
    @Query() pagina: PaginacionDto,
  ) {
    return this.solicitudes.pendientes(id, usuarioId, pagina);
  }

  @Patch(':id/solicitudes/:solicitudId/aprobar')
  async aprobar(
    @Param('id') id: string,
    @Param('solicitudId') solicitudId: string,
    @CurrentPersonaId() usuarioId: string,
  ) {
    const resultado = await this.solicitudes.resolver(
      id,
      solicitudId,
      usuarioId,
      'APPROVED',
    );
    if (resultado.incorporado)
      this.events.publish(
        id,
        'participante:unido',
        resultado.solicitud.solicitante.id,
      );
    return resultado.solicitud;
  }

  @Patch(':id/solicitudes/:solicitudId/rechazar')
  async rechazar(
    @Param('id') id: string,
    @Param('solicitudId') solicitudId: string,
    @CurrentPersonaId() usuarioId: string,
  ) {
    return (
      await this.solicitudes.resolver(id, solicitudId, usuarioId, 'REJECTED')
    ).solicitud;
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.desafiosService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() datos: UpdateDesafioDto,
    @CurrentPersonaId() usuarioId: string,
  ) {
    return this.desafiosService.update(id, datos, usuarioId);
  }

  @Patch(':id/cancelar')
  async cancel(@Param('id') id: string, @CurrentPersonaId() usuarioId: string) {
    const result = await this.desafiosService.cancel(id, usuarioId);
    this.events.publish(id, 'desafio:cancelado', usuarioId);
    return result;
  }

  @Post('unirse/:codigo')
  join() {
    throw new GoneException(
      'El ingreso inmediato fue retirado. Envia el codigo a POST /solicitudes.',
    );
  }

  @Post(':id/abandonar')
  async leave(@Param('id') id: string, @CurrentPersonaId() usuarioId: string) {
    const result = await this.desafiosService.leave(id, usuarioId);
    this.events.publish(id, 'participante:abandono', usuarioId);
    return result;
  }

  @Get(':id/participantes')
  findParticipantes(@Param('id') id: string) {
    return this.desafiosService.findParticipantes(id);
  }
}
