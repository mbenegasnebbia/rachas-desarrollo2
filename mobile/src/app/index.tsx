import { Redirect } from "expo-router";
import { useSesion } from "@/session/Sesion";
import { EstadoCarga, Pantalla } from "@/components/UI";
export default function Entrada() {
  const s = useSesion();
  if (s.cargando) return <Pantalla><EstadoCarga cargando error="" reintentar={s.reintentar} /></Pantalla>;
  return <Redirect href={s.persona?.perfilCompleto ? "/(tabs)" : "/ingreso"} />;
}
