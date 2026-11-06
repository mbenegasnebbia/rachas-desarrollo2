import {
  IsString,
  MinLength,
  MaxLength,
  Matches,
  ValidateIf,
  IsTimeZone,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CompleteProfileDto {
  @IsString()
  @MinLength(3)
  @MaxLength(20)
  @Matches(/^[a-zA-Z0-9_]+$/)
  alias!: string;

  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @MinLength(1)
  @MaxLength(100)
  nombre?: string;

  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @IsTimeZone()
  zonaHoraria?: string;
}
