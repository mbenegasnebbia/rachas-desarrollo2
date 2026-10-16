import {
  IsString,
  IsNotEmpty,
  MinLength,
  MaxLength,
  IsOptional,
  IsIn,
  IsDateString,
  IsInt,
  Min,
  Max,
} from 'class-validator';

export class CreateDesafioDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(60)
  nombre!: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  descripcion?: string;

  @IsIn(['SALUD', 'ESTUDIO', 'FINANZAS', 'BIENESTAR', 'OTRO'])
  categoria!: string;

  @IsDateString()
  fechaInicio!: string;

  @IsDateString()
  fechaFin!: string;

  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(20)
  maxParticipantes?: number;
}