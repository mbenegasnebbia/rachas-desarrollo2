import { Redirect } from "expo-router";

import { EstadoCarga, Pantalla } from "@/components/ui";
import { useSesion } from "@/session/sesion";

export default function Entrada() {
  const s = useSesion();
  if (s.cargando)
    return (
      <Pantalla>
        <EstadoCarga cargando error="" reintentar={s.reintentar} />
      </Pantalla>
    );
  return <Redirect href={s.persona?.perfilCompleto ? "/(tabs)" : "/ingreso"} />;
}
