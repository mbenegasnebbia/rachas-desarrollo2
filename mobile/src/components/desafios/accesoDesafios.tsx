import { useCallback, useState } from "react";

import { listarTodasSolicitudesPropias } from "@/api/solicitudes";
import { useCarga } from "@/hooks/useCarga";
import { useSesion } from "@/session/sesion";
import type { SolicitudAcceso } from "@/types";

import { SolicitarAccesoFormulario } from "./solicitarAccesoFormulario";
import { SolicitudesPendientes } from "./solicitudesPendientes";

export function AccesoDesafios({
  alSolicitar,
  revision = 0,
}: {
  alSolicitar: () => Promise<void>;
  revision?: number;
}) {
  const { persona, usuarioFirebase } = useSesion();
  const uid = usuarioFirebase?.uid;
  const carga = useCarga(
    useCallback(() => listarTodasSolicitudesPropias(uid), [uid]),
    (persona?.id ?? "") + ":" + (uid ?? "") + ":" + revision,
  );
  const [actualizacion, setActualizacion] = useState<SolicitudAcceso | null>(
    null,
  );
  return (
    <>
      <SolicitarAccesoFormulario
        solicitudes={carga.datos ?? []}
        actualizacion={actualizacion}
        alSolicitar={async (solicitud) => {
          setActualizacion(solicitud);
          await carga.cargar();
          await alSolicitar();
        }}
      />
      <SolicitudesPendientes
        solicitudes={carga.datos ?? []}
        cargando={carga.cargando}
        error={carga.error}
        refrescar={carga.cargar}
        alCancelar={setActualizacion}
      />
    </>
  );
}
