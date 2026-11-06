import { CurrentPersonaId } from '../auth/auth.decorators';
import { Controller, Post, Get, Patch, Body, Param } from '@nestjs/common';

import { ListarDesafiosDto } from './dto/listar-desafios.dto';
import { DesafiosService } from './desafios.service';
import { CreateDesafioDto } from './dto/create-desafio.dto';
import { UpdateDesafioDto } from './dto/update-desafio.dto';
import { Query } from '@nestjs/common';

@Controller('desafios')
export class DesafiosController {
  constructor(private desafiosService: DesafiosService) {}

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
  cancel(@Param('id') id: string, @CurrentPersonaId() usuarioId: string) {
    return this.desafiosService.cancel(id, usuarioId);
  }

  @Post('unirse/:codigo')
  join(@Param('codigo') codigo: string, @CurrentPersonaId() usuarioId: string) {
    return this.desafiosService.join(codigo, usuarioId);
  }

  @Post(':id/abandonar')
  leave(@Param('id') id: string, @CurrentPersonaId() usuarioId: string) {
    return this.desafiosService.leave(id, usuarioId);
  }

  @Get(':id/participantes')
  findParticipantes(@Param('id') id: string) {
    return this.desafiosService.findParticipantes(id);
  }
}
