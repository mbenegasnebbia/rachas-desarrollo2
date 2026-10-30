import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min, Max } from 'class-validator';
export class PaginacionDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) pagina = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limite = 10;
}
export function paginar<T>(items: T[], { pagina, limite }: PaginacionDto) {
  return {
    items: items.slice((pagina - 1) * limite, pagina * limite),
    total: items.length,
    pagina,
    limite,
    paginas: Math.ceil(items.length / limite),
  };
}
