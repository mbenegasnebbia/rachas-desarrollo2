import { useState } from "react";
import { Platform, Share } from "react-native";

import { Aviso, Boton, useEstilos } from "@/components/ui";
import { SeccionExpandible } from "@/components/ui/seccionExpandible";
import { Texto } from "@/components/ui/texto";
import { useAccion } from "@/hooks/useCarga";
import type { Desafio } from "@/types";

interface Props {
  desafio: Desafio;
  vigente: boolean;
  participa: boolean;
}

export function Invitacion({
  desafio,
  vigente,
  participa,
}: Props) {
  const estilos = useEstilos();

  const accion = useAccion();
  const [aviso, setAviso] = useState("");
  const mensaje = `Sumate a "${desafio.nombre}" en Rachas con el código ${desafio.codigoInvitacion}.`;
  async function copiar(texto: string, confirmacion: string) {
    setAviso("");
    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText)
      throw new Error(
        "No se puede copiar en este navegador. Seleccioná el código y copialo manualmente.",
      );
    try {
      await navigator.clipboard.writeText(texto);
    } catch {
      throw new Error(
        "No se pudo copiar. Revisá los permisos del navegador o copiá el código manualmente.",
      );
    }
    setAviso(confirmacion);
  }
  return (
    <SeccionExpandible
      titulo="Invitar personas"
      resumen="Compartí el código del desafío"
    >
      <Texto selectable variante="tarjetaTitulo">
        Código: {desafio.codigoInvitacion}
      </Texto>
      {Platform.OS === "web" ? (
        <>
          <Boton
            titulo="Copiar código"
            secundario
            disabled={accion.ocupado || !vigente}
            onPress={() =>
              void accion.ejecutar(() =>
                copiar(desafio.codigoInvitacion, "Código copiado."),
              )
            }
          />
          <Boton
            titulo="Copiar mensaje de invitación"
            secundario
            disabled={accion.ocupado || !vigente}
            onPress={() =>
              void accion.ejecutar(() =>
                copiar(mensaje, "Mensaje de invitación copiado."),
              )
            }
          />
        </>
      ) : (
        <Boton
          titulo="Compartir invitación"
          secundario={!participa}
          disabled={accion.ocupado || !vigente}
          onPress={() =>
            void accion.ejecutar(async () => {
              await Share.share({ message: mensaje });
            })
          }
        />
      )}
      <Aviso texto={accion.error} />
      {aviso && vigente ? (
        <Texto accessibilityLiveRegion="polite" style={estilos.texto}>
          {aviso}
        </Texto>
      ) : null}
    </SeccionExpandible>
  );
}
