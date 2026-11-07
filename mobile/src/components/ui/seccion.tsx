import type { ReactNode } from "react";

import { Encabezado } from "./encabezado";
import { Tarjeta } from "./tarjeta";

interface Props {
  titulo: string;
  descripcion?: string;
  children: ReactNode;
}

export function Seccion({
  titulo,
  descripcion,
  children,
}: Props) {
  return (
    <Tarjeta>
      <Encabezado
        variante="tarjetaTitulo"
        titulo={titulo}
        descripcion={descripcion}
      />
      {children}
    </Tarjeta>
  );
}
