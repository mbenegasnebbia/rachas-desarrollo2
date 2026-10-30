import { IsMongoId } from 'class-validator';
import { PaginacionDto } from '../../common/paginacion.dto';
export class ListarCheckinsDto extends PaginacionDto {
  @IsMongoId() personaId!: string;
}
