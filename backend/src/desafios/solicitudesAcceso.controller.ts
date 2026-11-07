import { SolicitarAccesoDto } from './dto/solicitarAcceso.dto';
import {
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Post,
  Body,
  HttpCode,
} from '@nestjs/common';
import { CurrentPersonaId } from '../auth/auth.decorators';
import { PaginacionDto } from '../common/paginacion.dto';
import { SolicitudesAccesoService } from './solicitudesAcceso.service';

@Controller('solicitudes')
export class SolicitudesAccesoController {
  constructor(private readonly solicitudes: SolicitudesAccesoService) {}

  @Post()
  @HttpCode(200)
  solicitar(
    @Body() body: SolicitarAccesoDto,
    @CurrentPersonaId() usuarioId: string,
  ) {
    return this.solicitudes.solicitar(body.codigo, usuarioId);
  }

  @Get()
  propias(
    @CurrentPersonaId() usuarioId: string,
    @Query() pagina: PaginacionDto,
  ) {
    return this.solicitudes.propias(usuarioId, pagina);
  }

  @Patch(':id/cancelar')
  cancelar(@Param('id') id: string, @CurrentPersonaId() usuarioId: string) {
    return this.solicitudes.cancelar(id, usuarioId);
  }
}
