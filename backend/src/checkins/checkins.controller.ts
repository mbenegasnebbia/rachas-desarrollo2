import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Headers,
  Query,
} from '@nestjs/common';

import { ListarCheckinsDto } from './dto/listar-checkins.dto';
import { CheckinsService } from './checkins.service';
import { CreateCheckinDto } from './dto/create-checkin.dto';

@Controller('desafios/:desafioId/checkins')
export class CheckinsController {
  constructor(private checkinsService: CheckinsService) {}

  @Post()
  create(
    @Param('desafioId') desafioId: string,
    @Headers('x-usuario-id') usuarioId: string,
    @Body() datos: CreateCheckinDto,
  ) {
    return this.checkinsService.create(desafioId, usuarioId, datos);
  }

  @Delete('ultimo')
  undo(
    @Param('desafioId') desafioId: string,
    @Headers('x-usuario-id') usuarioId: string,
  ) {
    return this.checkinsService.undo(desafioId, usuarioId);
  }

  @Get()
  findByPersona(
    @Param('desafioId') desafioId: string,
    @Query() query: ListarCheckinsDto,
  ) {
    return this.checkinsService.findByPersona(
      desafioId,
      query.personaId,
      query,
    );
  }
}
