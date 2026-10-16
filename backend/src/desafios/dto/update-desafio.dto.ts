import {
  IsOptional,
  IsString,
  MinLength,
  MaxLength,
  IsDateString,
  IsInt,
  Min,
  Max,
} from 'class-validator';

export class UpdateDesafioDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(60)
  nombre?: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  descripcion?: string;

  @IsOptional()
  @IsDateString()
  fechaInicio?: string;

  @IsOptional()
  @IsDateString()
  fechaFin?: string;

  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(20)
  maxParticipantes?: number;
}