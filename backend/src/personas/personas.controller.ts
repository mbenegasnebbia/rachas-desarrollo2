import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { PersonasService } from './personas.service';
import { CreatePersonaDto } from './dto/create-persona.dto';
import { UpdatePersonaDto } from './dto/update-persona.dto';

@Controller('personas')
export class PersonasController {
  constructor(private readonly personasService: PersonasService) {}

  @Post()
  create(@Body() datos: CreatePersonaDto) {
    return this.personasService.create(datos);
  }

  @Get()
    findAll() {
      return this.personasService.findAll();
    }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.personasService.findOne(id);
  }
  
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() datos: UpdatePersonaDto,
  ) {
    return this.personasService.update(id, datos);
  }

  @Get(':id/desafios')
  findDesafios(@Param('id') id: string) {
    return this.personasService.findDesafios(id);
  }
}
