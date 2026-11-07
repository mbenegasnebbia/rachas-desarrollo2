import { useCallback, useState } from "react";
import { View } from "react-native";

import {
  listarSolicitudesRecibidas,
  resolverSolicitud,
} from "@/api/solicitudes";
import {
  Aviso,
  Boton,
  Encabezado,
  EstadoCarga,
  Paginador,
  Tarjeta,
} from "@/components/ui";
import { Texto } from "@/components/ui/texto";
import { useAccion, useCarga } from "@/hooks/useCarga";
import { useSesion } from "@/session/sesion";
import { useEstilos } from "@/theme/estilos";
import type { Desafio, SolicitudAcceso } from "@/types";
import { fechaVisible } from "@/utils/fechas";

import { EstadoSolicitud } from "./estadoSolicitud";

interface Props {
  desafio: Desafio;
  volver: () => void;
  alResolver: () => Promise<void>;
}

export function SolicitudesRecibidas({ desafio, volver, alResolver }: Props) {
  const { persona, usuarioFirebase } = useSesion();
  const uid = usuarioFirebase?.uid;
  const estilos = useEstilos();
  const [pagina, setPagina] = useState(1);
  const [resueltas, setResueltas] = useState<string[]>([]);
  const [procesando, setProcesando] = useState<{
    id: string;
    decision: "aprobar" | "rechazar";
  } | null>(null);
  const [aviso, setAviso] = useState("");
  const esCreador = desafio.creador === persona?.id;
  const carga = useCarga(
    useCallback(() => {
      if (!esCreador)
        return Promise.reject(
          new Error("Solo el creador puede administrar solicitudes."),
        );
      return listarSolicitudesRecibidas(desafio.id, pagina, 10, uid);
    }, [esCreador, desafio.id, pagina, uid]),
    (persona?.id ?? "") + ":" + (uid ?? "") + ":" + desafio.id + ":" + pagina,
  );
  const accion = useAccion();
  if (!esCreador) return null;
  const visibles = (carga.datos?.items ?? []).filter(
    (s) => s.estado === "PENDING" && !resueltas.includes(s.id),
  );

  async function resolver(
    solicitud: SolicitudAcceso,
    decision: "aprobar" | "rechazar",
  ) {
    await accion.ejecutar(async () => {
      setProcesando({ id: solicitud.id, decision });
      setAviso("");
      try {
        const respuesta = await resolverSolicitud(
          desafio.id,
          solicitud.id,
          decision,
          uid,
        );
        if (
          respuesta.estado !==
          (decision === "aprobar" ? "APPROVED" : "REJECTED")
        )
          throw new Error(
            "No se pudo confirmar la resolución. Actualizá las solicitudes.",
          );
        setResueltas((previas) => [...previas, solicitud.id]);
        setAviso(
          decision === "aprobar"
            ? "Solicitud aprobada. Ya puede participar."
            : "Solicitud rechazada.",
        );
        await carga.cargar();
        await alResolver();
        if (visibles.length === 1 && pagina > 1) setPagina(pagina - 1);
      } catch (error) {
        await carga.cargar();
        await alResolver();
        throw error;
      } finally {
        setProcesando(null);
      }
    });
  }

  return (
    <View style={estilos.seccion}>
      <Boton
        titulo="Volver a Mis creados"
        secundario
        onPress={volver}
        disabled={accion.ocupado}
      />
      <Encabezado
        titulo={desafio.nombre}
        descripcion="Solicitudes de acceso"
        variante="seccionTitulo"
        descripcionVariante="cuerpoSecundario"
      />
      <EstadoCarga
        {...carga}
        vacio={visibles.length === 0}
        mensajeVacio="Este desafío no tiene solicitudes pendientes."
        reintentar={carga.cargar}
      />
      <Aviso texto={accion.error} />
      {!!aviso && (
        <Texto accessibilityLiveRegion="polite" tono="exito">
          {aviso}
        </Texto>
      )}
      {!carga.error &&
        visibles.map((s) => (
          <Tarjeta key={s.id}>
            <Texto variante="tarjetaTitulo">
              @{s.solicitante.alias ?? "usuario no disponible"}
            </Texto>
            <Texto variante="cuerpoSecundario" tono="textoSecundario">
              Solicitada el {fechaVisible(s.solicitadaEn)}
            </Texto>
            <EstadoSolicitud estado={s.estado} />
            <Boton
              titulo={
                procesando?.id === s.id && procesando.decision === "aprobar"
                  ? "Aprobando…"
                  : "Aprobar"
              }
              cargando={
                procesando?.id === s.id && procesando.decision === "aprobar"
              }
              disabled={accion.ocupado || carga.cargando}
              onPress={() => void resolver(s, "aprobar")}
            />
            <Boton
              titulo={
                procesando?.id === s.id && procesando.decision === "rechazar"
                  ? "Rechazando…"
                  : "Rechazar"
              }
              secundario
              cargando={
                procesando?.id === s.id && procesando.decision === "rechazar"
              }
              disabled={accion.ocupado || carga.cargando}
              onPress={() => void resolver(s, "rechazar")}
            />
          </Tarjeta>
        ))}
      {(carga.datos?.paginas ?? 0) > 1 && (
        <Paginador
          pagina={pagina}
          paginas={carga.datos?.paginas ?? 0}
          cambiar={setPagina}
          disabled={carga.cargando || accion.ocupado}
        />
      )}
    </View>
  );
}
