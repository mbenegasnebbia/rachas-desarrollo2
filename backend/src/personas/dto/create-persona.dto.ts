import {
  IsString,
  IsNotEmpty,
  MinLength,
  MaxLength,
  Matches,
  IsEmail,
  IsOptional,
  IsTimeZone,
} from 'class-validator';

export class CreatePersonaDto {
  @IsString()
  @IsNotEmpty()
  nombre!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(20)
  @Matches(/^[a-zA-Z0-9_]+$/)
  alias!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsTimeZone()
  zonaHoraria?: string;
}