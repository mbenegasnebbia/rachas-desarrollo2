import { Controller, Get, Headers, Param } from '@nestjs/common';
import { ProgresoService } from './progreso.service';
@Controller()
export class ProgresoController {
  constructor(private readonly progreso: ProgresoService) {}
  @Get('desafios/:id/ranking') ranking(@Param('id') id: string) {
    return this.progreso.ranking(id);
  }
  @Get('desafios/:id/racha/:personaId') racha(
    @Param('id') id: string,
    @Param('personaId') personaId: string,
  ) {
    return this.progreso.racha(id, personaId);
  }
  @Get('personas/me/resumen') resumen(@Headers('x-usuario-id') id: string) {
    return this.progreso.resumen(id);
  }
  @Get('personas/me/resultados') resultados(
    @Headers('x-usuario-id') id: string,
  ) {
    return this.progreso.resultados(id);
  }
}
