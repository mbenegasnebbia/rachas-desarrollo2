import { useState } from "react";
import { Platform, Share, Text, View } from "react-native";
import { useAccion } from "@/hooks/useCarga";
import type { Desafio } from "@/types";
import { Aviso, Boton, estilos } from "./UI";

export function Invitacion({
  desafio,
  vigente,
  participa,
}: {
  desafio: Desafio;
  vigente: boolean;
  participa: boolean;
}) {
  const accion = useAccion();
  const [aviso, setAviso] = useState("");
  const mensaje = `Sumate a "${desafio.nombre}" en Rachas con el código ${desafio.codigoInvitacion}.`;
  async function copiar(texto: string, confirmacion: string) {
    setAviso("");
    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText)
      throw new Error("No se puede copiar en este navegador. Seleccioná el código y copialo manualmente.");
    try {
      await navigator.clipboard.writeText(texto);
    } catch {
      throw new Error("No se pudo copiar. Revisá los permisos del navegador o copiá el código manualmente.");
    }
    setAviso(confirmacion);
  }
  return (
    <View style={estilos.tarjeta}>
      <Text selectable style={estilos.subtitulo}>
        Código: {desafio.codigoInvitacion}
      </Text>
      {Platform.OS === "web" ? (
        <>
          <Boton
            titulo="Copiar código"
            secundario
            disabled={accion.ocupado || !vigente}
            onPress={() => void accion.ejecutar(() => copiar(desafio.codigoInvitacion, "Código copiado."))}
          />
          <Boton
            titulo="Copiar mensaje de invitación"
            secundario
            disabled={accion.ocupado || !vigente}
            onPress={() => void accion.ejecutar(() => copiar(mensaje, "Mensaje de invitación copiado."))}
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
      {aviso && vigente ? <Text accessibilityLiveRegion="polite" style={estilos.texto}>{aviso}</Text> : null}
    </View>
  );
}
