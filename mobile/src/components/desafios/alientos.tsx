import { Pressable, View, type DimensionValue } from "react-native";

import { Aviso } from "@/components/ui";
import { Boton } from "@/components/ui/boton";
import { Tarjeta } from "@/components/ui/tarjeta";
import { Texto } from "@/components/ui/texto";
import { EMOJIS, type Aliento } from "@/hooks/realtimeTypes";
import { useTema } from "@/theme/useTema";

interface Props {
  activo: boolean;
  realtime: {
    estado: string;
    error: string;
    aviso: string;
    enEspera: boolean;
    enviando: boolean;
    alientos: Aliento[];
    enviar: (emoji: string) => void;
    reconectar: () => void;
  };
}
// Presentation only; sockets, validation and cooldown remain in the existing hook.
export function Alientos({ activo, realtime }: Props) {
  const tema = useTema();
  return (
    <Tarjeta
      style={{
        backgroundColor: tema.colores.fondoAlientos,
        borderColor: tema.colores.fondoAlientos,
      }}
    >
      <Texto variante="tarjetaTitulo" tono="textoAlientos">
        Mandá un aliento
      </Texto>
      <Texto variante="cuerpoSecundario" tono="detalleAlientos">
        Un empujoncito para el equipo
      </Texto>
      {realtime.estado !== "Conectado" && (
        <View style={{ gap: tema.espacios.sm }}>
          <Texto
            variante="cuerpoSecundario"
            tono="detalleAlientos"
            accessibilityLiveRegion="polite"
          >
            {realtime.estado}
          </Texto>
          <Boton titulo="Reconectar" secundario onPress={realtime.reconectar} />
        </View>
      )}
      <Aviso texto={realtime.error} />
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {EMOJIS.map((emoji) => (
          <View
            key={emoji}
            style={{
              width: (100 / tema.medidas.columnasReacciones +
                "%") as DimensionValue,
              alignItems: "center",
              paddingVertical: tema.espacios.xs,
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={"Enviar aliento " + emoji}
              disabled={
                !activo ||
                realtime.estado !== "Conectado" ||
                realtime.enviando ||
                realtime.enEspera
              }
              accessibilityState={{
                disabled:
                  !activo ||
                  realtime.estado !== "Conectado" ||
                  realtime.enviando ||
                  realtime.enEspera,
              }}
              onPress={() => realtime.enviar(emoji)}
              style={({ pressed }) => ({
                minWidth: tema.medidas.toqueMinimo,
                minHeight: tema.medidas.toqueMinimo,
                borderRadius: tema.radios.circular,
                backgroundColor: tema.colores.superficie,
                padding: tema.espacios.xs,
                justifyContent: "center",
                alignItems: "center",
                opacity:
                  pressed ||
                  !activo ||
                  realtime.estado !== "Conectado" ||
                  realtime.enviando ||
                  realtime.enEspera
                    ? tema.interaccion.opacidadPresionado
                    : 1,
              })}
            >
              <Texto variante="seccionTitulo">{emoji}</Texto>
            </Pressable>
          </View>
        ))}
      </View>
      {(realtime.enEspera || !!realtime.aviso) && (
        <Texto
          variante="cuerpoSecundario"
          tono="detalleAlientos"
          accessibilityLiveRegion="polite"
        >
          {realtime.enEspera
            ? "Esperá antes de volver a alentar (10 segundos entre envíos)."
            : realtime.aviso}
        </Texto>
      )}
      {realtime.alientos.map((aliento) => (
        <Texto
          key={aliento.id}
          variante="cuerpoSecundario"
          tono="textoAlientos"
          accessibilityLiveRegion="polite"
        >
          {aliento.emoji} {aliento.nombre} envió un aliento
        </Texto>
      ))}
    </Tarjeta>
  );
}
