import { useState } from "react";
import { View } from "react-native";

import { cancelarSolicitud } from "@/api/solicitudes";
import {
  Aviso,
  Boton,
  Encabezado,
  EstadoCarga,
  Paginador,
  Tarjeta,
} from "@/components/ui";
import { Texto } from "@/components/ui/texto";
import { useAccion } from "@/hooks/useCarga";
import { useSesion } from "@/session/sesion";
import { useEstilos } from "@/theme/estilos";
import type { SolicitudAcceso } from "@/types";
import { fechaVisible } from "@/utils/fechas";

import { EstadoSolicitud } from "./estadoSolicitud";

interface Props {
  solicitudes: SolicitudAcceso[];
  cargando: boolean;
  error: string;
  refrescar: () => Promise<void>;
  alCancelar: (solicitud: SolicitudAcceso) => void;
}

export function SolicitudesPendientes({
  solicitudes,
  cargando,
  error,
  refrescar,
  alCancelar,
}: Props) {
  const { usuarioFirebase } = useSesion();
  const uid = usuarioFirebase?.uid;
  const estilos = useEstilos();
  const carga = { datos: solicitudes, cargando, error, cargar: refrescar };
  const accion = useAccion();
  const [pagina, setPagina] = useState(1);
  const [ocultas, setOcultas] = useState<string[]>([]);
  const [procesando, setProcesando] = useState("");
  const [aviso, setAviso] = useState("");
  const pendientes = solicitudes.filter(
    (s) => s.estado === "PENDING" && !ocultas.includes(s.id),
  );
  const paginas = Math.ceil(pendientes.length / 10);
  const actual = Math.max(1, Math.min(pagina, paginas || 1));

  if (!carga.cargando && !carga.error && pendientes.length === 0) {
    if (!aviso && !accion.error) return null;
    return (
      <View style={estilos.grupo}>
        <Aviso texto={accion.error} />
        {!!aviso && (
          <Texto accessibilityLiveRegion="polite" tono="exito">
            {aviso}
          </Texto>
        )}
      </View>
    );
  }

  return (
    <View style={estilos.seccion}>
      <Encabezado titulo="Solicitudes pendientes" variante="tarjetaTitulo" />
      <EstadoCarga {...carga} reintentar={carga.cargar} />
      <Aviso texto={accion.error} />
      {!!aviso && (
        <Texto accessibilityLiveRegion="polite" tono="exito">
          {aviso}
        </Texto>
      )}
      {!carga.error &&
        pendientes.slice((actual - 1) * 10, actual * 10).map((s) => (
          <Tarjeta key={s.id}>
            <Texto variante="tarjetaTitulo">
              {s.desafio.nombre ?? "Desafío no disponible"}
            </Texto>
            <EstadoSolicitud estado={s.estado} />
            <Texto variante="cuerpoSecundario" tono="textoSecundario">
              Solicitada el {fechaVisible(s.solicitadaEn)}
            </Texto>
            <Boton
              titulo={
                procesando === s.id ? "Cancelando…" : "Cancelar solicitud"
              }
              secundario
              accessibilityLabel={
                "Cancelar solicitud a " + (s.desafio.nombre ?? "desafío")
              }
              cargando={procesando === s.id}
              disabled={accion.ocupado || carga.cargando}
              onPress={() =>
                void accion.ejecutar(async () => {
                  setProcesando(s.id);
                  setAviso("");
                  try {
                    const respuesta = await cancelarSolicitud(s.id, uid);
                    if (respuesta.estado !== "CANCELLED")
                      throw new Error(
                        "No se pudo confirmar la cancelaci\u00f3n.",
                      );
                    alCancelar(respuesta);
                    setOcultas((previas) => [...previas, s.id]);
                    setPagina(1);
                    setAviso(
                      "Solicitud cancelada. Por ahora no podés volver a enviarla.",
                    );
                    await carga.cargar();
                  } catch (error) {
                    await carga.cargar();
                    throw error;
                  } finally {
                    setProcesando("");
                  }
                })
              }
            />
          </Tarjeta>
        ))}
      {paginas > 1 && (
        <Paginador
          pagina={actual}
          paginas={paginas}
          cambiar={setPagina}
          disabled={carga.cargando || accion.ocupado}
        />
      )}
    </View>
  );
}
