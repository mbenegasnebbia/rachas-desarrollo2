import { IsIn, IsOptional } from 'class-validator';
import { PaginacionDto } from '../../common/paginacion.dto';
export class ListarDesafiosDto extends PaginacionDto {
  @IsOptional()
  @IsIn(['PROGRAMADO', 'ACTIVO', 'FINALIZADO', 'CANCELADO', 'PAUSADO'])
  estado?: string;
  @IsOptional()
  @IsIn(['SALUD', 'ESTUDIO', 'FINANZAS', 'BIENESTAR', 'OTRO'])
  categoria?: string;
}
