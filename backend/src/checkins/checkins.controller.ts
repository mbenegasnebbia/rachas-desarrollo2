import { RealtimeEventsService } from '../realtime/realtime-events.service';
import { CurrentPersonaId, requireOwner } from '../auth/auth.decorators';
import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';

import { ListarCheckinsDto } from './dto/listar-checkins.dto';
import { CheckinsService } from './checkins.service';
import { CreateCheckinDto } from './dto/create-checkin.dto';

@Controller('desafios/:desafioId/checkins')
export class CheckinsController {
  constructor(
    private checkinsService: CheckinsService,
    private readonly events: RealtimeEventsService,
  ) {}

  @Post()
  async create(
    @Param('desafioId') desafioId: string,
    @CurrentPersonaId() usuarioId: string,
    @Body() datos: CreateCheckinDto,
  ) {
    const result = await this.checkinsService.create(
      desafioId,
      usuarioId,
      datos,
    );
    this.events.publish(desafioId, 'checkin:registrado', usuarioId);
    return result;
  }

  @Delete('ultimo')
  async undo(
    @Param('desafioId') desafioId: string,
    @CurrentPersonaId() usuarioId: string,
  ) {
    const result = await this.checkinsService.undo(desafioId, usuarioId);
    this.events.publish(desafioId, 'checkin:deshecho', usuarioId);
    return result;
  }

  @Get()
  findByPersona(
    @Param('desafioId') desafioId: string,
    @Query() query: ListarCheckinsDto,
    @CurrentPersonaId() currentId: string,
  ) {
    requireOwner(query.personaId, currentId);
    return this.checkinsService.findByPersona(
      desafioId,
      query.personaId,
      query,
    );
  }
}
