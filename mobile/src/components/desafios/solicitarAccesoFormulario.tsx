import { router } from "expo-router";
import { useState } from "react";

import { ApiError } from "@/api/client";
import { listarParticipaciones, solicitarAcceso } from "@/api/solicitudes";
import { Aviso, Boton, Campo, Tarjeta } from "@/components/ui";
import { IconoCircular } from "@/components/ui/iconoCircular";
import { Texto } from "@/components/ui/texto";
import { useAccion } from "@/hooks/useCarga";
import { useSesion } from "@/session/sesion";
import type { Desafio, SolicitudAcceso } from "@/types";

import { EstadoSolicitud } from "./estadoSolicitud";

interface Props {
  codigoEsperado?: string;
  solicitudes?: SolicitudAcceso[];
  actualizacion?: SolicitudAcceso | null;
  disabled?: boolean;
  alSolicitar?: (solicitud: SolicitudAcceso) => Promise<void> | void;
}

const mensajes = {
  PENDING:
    "Solicitud enviada. El creador del desafío tiene que aprobar tu ingreso",
  APPROVED: "Tu solicitud fue aprobada. Ya podés abrir el desafío.",
  REJECTED:
    "El creador rechazó tu solicitud. Por ahora no podés volver a enviarla.",
  CANCELLED: "Cancelaste esta solicitud. Por ahora no podés volver a enviarla.",
};

export function SolicitarAccesoFormulario({
  codigoEsperado,
  disabled = false,
  alSolicitar,
  solicitudes = [],
  actualizacion,
}: Props) {
  const { persona, usuarioFirebase } = useSesion();
  const [codigo, setCodigo] = useState("");
  const [enviado, setEnviado] = useState("");
  const [solicitud, setSolicitud] = useState<SolicitudAcceso | null>(null);
  const [participacion, setParticipacion] = useState<Desafio | null>(null);
  const accion = useAccion();
  const normalizado = codigo.trim().toUpperCase();
  const mismoCodigo = enviado === normalizado;
  // Terminal states cannot return to PENDING. A fresh confirmed resolution
  // must not be overwritten by an older list snapshot after a failed refresh.
  const actual = solicitudes.find((s) => s.id === solicitud?.id);
  const ultima =
    (actualizacion?.id === solicitud?.id && actualizacion?.estado !== "PENDING"
      ? actualizacion
      : null) ??
    (solicitud?.estado !== "PENDING" ? solicitud : null) ??
    actual ??
    solicitud;
  const resultado = mismoCodigo ? ultima : null;
  const existente = mismoCodigo ? participacion : null;

  return (
    <Tarjeta>
      <IconoCircular icono="llave" tono="secundario" variante="suave" />
      <Texto variante="tarjetaTitulo">Solicitar acceso con código</Texto>
      <Texto variante="cuerpoSecundario" tono="textoSecundario">
        El creador tiene que aprobar tu ingreso antes de que puedas participar.
      </Texto>
      <Campo
        etiqueta="Código de invitación"
        autoCapitalize="characters"
        maxLength={6}
        editable={!accion.ocupado && !disabled}
        value={codigo}
        onChangeText={(texto) => {
          setCodigo(texto);
          accion.limpiarError();
        }}
      />
      <Aviso texto={accion.error} />
      <Boton
        titulo={
          accion.ocupado
            ? "Enviando solicitud…"
            : resultado
              ? "Solicitud " +
                (
                  {
                    PENDING: "pendiente",
                    APPROVED: "aprobada",
                    REJECTED: "rechazada",
                    CANCELLED: "cancelada",
                  } as const
                )[resultado.estado]
              : existente
                ? "Ya participás"
                : "Solicitar acceso"
        }
        cargando={accion.ocupado}
        disabled={disabled || accion.ocupado || !!resultado || !!existente}
        onPress={() =>
          void accion.ejecutar(async () => {
            if (!/^[A-Z0-9]{6}$/.test(normalizado))
              throw new Error("Ingresá un código de 6 letras o números.");
            if (codigoEsperado && normalizado !== codigoEsperado.toUpperCase())
              throw new Error("El código no corresponde a este desafío.");
            try {
              const recibida = await solicitarAcceso(
                normalizado,
                usuarioFirebase?.uid,
              );
              setEnviado(normalizado);
              setSolicitud(recibida);
              setParticipacion(null);
              await alSolicitar?.(recibida);
            } catch (error) {
              // A participant without a previous request receives 409. Resolve only
              // through the authenticated owner's existing participation endpoint.
              if (
                error instanceof ApiError &&
                error.status === 409 &&
                persona
              ) {
                const propias = await listarParticipaciones(
                  persona.id,
                  usuarioFirebase?.uid,
                ).catch(() => []);
                const desafio = propias.find(
                  (d) => d.codigoInvitacion === normalizado,
                );
                if (desafio) {
                  setEnviado(normalizado);
                  setParticipacion(desafio);
                  setSolicitud(null);
                  return;
                }
              }
              throw error;
            }
          })
        }
      />
      {resultado && (
        <>
          <EstadoSolicitud estado={resultado.estado} />
          <Texto accessibilityLiveRegion="polite">
            {mensajes[resultado.estado]}
          </Texto>
        </>
      )}
      {existente && (
        <Texto accessibilityLiveRegion="polite">
          Ya participás en este desafío.
        </Texto>
      )}
      {(resultado?.estado === "APPROVED" || existente) && (
        <Boton
          titulo="Ver desafío"
          secundario
          onPress={() =>
            router.push({
              pathname: "/desafio/[id]",
              params: { id: existente?.id ?? resultado!.desafio.id },
            })
          }
        />
      )}
    </Tarjeta>
  );
}
