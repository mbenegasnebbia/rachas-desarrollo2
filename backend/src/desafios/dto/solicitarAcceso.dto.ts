import { IsString, Matches } from 'class-validator';

export class SolicitarAccesoDto {
  @IsString()
  @Matches(/^[A-Z0-9]{6}$/i, {
    message: 'codigo debe tener 6 letras o numeros',
  })
  codigo!: string;
}
