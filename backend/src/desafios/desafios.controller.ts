import { Controller, Post, Get, Patch, Body, Headers, Param, } from '@nestjs/common';

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
    @Headers('x-usuario-id') usuarioId: string,
  ) {
    return this.desafiosService.create(datos, usuarioId);
  }

  @Get()
  findAll(
    @Query('estado') estado?: string,
    @Query('categoria') categoria?: string,
  ) {
    return this.desafiosService.findAll(estado, categoria);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.desafiosService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() datos: UpdateDesafioDto,
    @Headers('x-usuario-id') usuarioId: string,
  ) {
    return this.desafiosService.update(id, datos, usuarioId);
  }

  @Patch(':id/cancelar')
  cancel(
    @Param('id') id: string,
    @Headers('x-usuario-id') usuarioId: string,
  ) {
    return this.desafiosService.cancel(id, usuarioId);
  }

  @Post('unirse/:codigo')
  join(
    @Param('codigo') codigo: string,
    @Headers('x-usuario-id') usuarioId: string,
  ) {
    return this.desafiosService.join(codigo, usuarioId);
  }

  @Post(':id/abandonar')
  leave(
    @Param('id') id: string,
    @Headers('x-usuario-id') usuarioId: string,
  ) {
    return this.desafiosService.leave(id, usuarioId);
  }

  @Get(':id/participantes')
  findParticipantes(@Param('id') id: string) {
    return this.desafiosService.findParticipantes(id);
  }
}