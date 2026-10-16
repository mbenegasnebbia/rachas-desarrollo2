import { IsOptional, IsString, IsNotEmpty, IsTimeZone } from 'class-validator';

export class UpdatePersonaDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  nombre?: string;

  @IsOptional()
  @IsTimeZone()
  zonaHoraria?: string;
}