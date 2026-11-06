import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  ForbiddenException,
} from '@nestjs/common';
import { CurrentPersonaId, requireOwner } from '../auth/auth.decorators';
import { PersonasService } from './personas.service';
import { UpdatePersonaDto } from './dto/update-persona.dto';

@Controller('personas')
export class PersonasController {
  constructor(private readonly personasService: PersonasService) {}

  @Post()
  create() {
    throw new ForbiddenException(
      'El alta se realiza mediante Google y /auth/persona',
    );
  }

  @Get()
  async findAll() {
    const personas = await this.personasService.findAll();
    return personas.map((p) => ({
      id: p._id.toString(),
      nombre: p.nombre,
      alias: p.alias,
    }));
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentPersonaId() currentId: string) {
    requireOwner(id, currentId);
    return this.personasService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() datos: UpdatePersonaDto,
    @CurrentPersonaId() currentId: string,
  ) {
    requireOwner(id, currentId);
    return this.personasService.update(id, datos);
  }

  @Get(':id/desafios')
  findDesafios(@Param('id') id: string, @CurrentPersonaId() currentId: string) {
    requireOwner(id, currentId);
    return this.personasService.findDesafios(id);
  }
}
