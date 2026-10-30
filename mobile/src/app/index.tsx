import { Redirect } from "expo-router";
import { useSesion } from "@/session/Sesion";
import { EstadoCarga, Pantalla } from "@/components/UI";
export default function Entrada() {
  const s = useSesion();
  if (s.cargando || s.error)
    return (
      <Pantalla>
        <EstadoCarga
          cargando={s.cargando}
          error={s.error}
          reintentar={s.reintentar}
        />
      </Pantalla>
    );
  return <Redirect href={s.persona ? "/(tabs)" : "/ingreso"} />;
}
