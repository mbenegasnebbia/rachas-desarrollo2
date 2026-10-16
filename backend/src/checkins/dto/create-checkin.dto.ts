import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  IsNumber,
} from 'class-validator';

export class CreateCheckinDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'La fecha debe tener el formato YYYY-MM-DD',
  })
  fecha!: string;

  @IsOptional()
  @IsString()
  @MaxLength(140)
  nota?: string;

  @IsOptional()
  @IsNumber()
  valor?: number;
}