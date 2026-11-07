import { Pressable, View } from "react-native";

import { useTema } from "@/theme/useTema";

import { Icono } from "./icono";
import { Texto } from "./texto";

interface Props {
  titulo: string;
  resumen?: string;
  expandido: boolean;
  onPress: () => void;
  tono?: "texto" | "textoRanking";
}

export function ControlDesplegable({
  titulo,
  resumen,
  expandido,
  onPress,
  tono = "texto",
}: Props) {
  const tema = useTema();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded: expandido }}
      accessibilityHint={expandido ? "Contraer sección" : "Expandir sección"}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: tema.medidas.toqueMinimo,
        justifyContent: "center",
        gap: tema.espacios.xs,
        opacity: pressed ? tema.interaccion.opacidadPresionado : 1,
      })}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: tema.espacios.sm,
        }}
      >
        <Texto variante="tarjetaTitulo" tono={tono} style={{ flex: 1 }}>
          {titulo}
        </Texto>
        <Icono
          nombre={expandido ? "chevronArriba" : "chevronAbajo"}
          color={tema.colores[tono]}
        />
      </View>
      {!!resumen && (
        <Texto variante="cuerpoSecundario" tono="textoSecundario">
          {resumen}
        </Texto>
      )}
    </Pressable>
  );
}
