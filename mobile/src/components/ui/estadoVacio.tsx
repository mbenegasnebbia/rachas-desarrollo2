import { IconoCircular } from "./iconoCircular";
import { Tarjeta } from "./tarjeta";
import { Texto } from "./texto";

interface Props {
  titulo?: string;
  mensaje: string;
}

export function EstadoVacio({
  titulo = "Un nuevo comienzo",
  mensaje,
}: Props) {
  return (
    <Tarjeta>
      <IconoCircular icono="explorar" tono="secundario" variante="suave" />
      <Texto variante="seccion">{titulo}</Texto>
      <Texto tono="textoSecundario">{mensaje}</Texto>
    </Tarjeta>
  );
}
