import { RealtimeEventsService } from '../realtime/realtime-events.service';
import { CurrentPersonaId } from '../auth/auth.decorators';
import { Controller, Post, Get, Patch, Body, Param } from '@nestjs/common';

import { ListarDesafiosDto } from './dto/listar-desafios.dto';
import { DesafiosService } from './desafios.service';
import { CreateDesafioDto } from './dto/create-desafio.dto';
import { UpdateDesafioDto } from './dto/update-desafio.dto';
import { Query } from '@nestjs/common';

@Controller('desafios')
export class DesafiosController {
  constructor(
    private desafiosService: DesafiosService,
    private readonly events: RealtimeEventsService,
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
  async join(
    @Param('codigo') codigo: string,
    @CurrentPersonaId() usuarioId: string,
  ) {
    const result = await this.desafiosService.join(codigo, usuarioId);
    this.events.publish(result._id.toString(), 'participante:unido', usuarioId);
    return result;
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
