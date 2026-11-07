import { View } from "react-native";

import { useTema } from "@/theme/useTema";

import { Texto } from "./texto";

interface Props {
  texto: string;
  tono?: "neutro" | "exito" | "advertencia" | "error";
}

export function Badge({
  texto,
  tono = "neutro",
}: Props) {
  const tema = useTema();

  const fondo =
    tono === "error"
      ? tema.colores.fondoError
      : tono === "exito"
        ? tema.colores.fondoExito
        : tono === "advertencia"
          ? tema.colores.fondoAdvertencia
          : tema.colores.superficieSuave;
  return (
    <View
      style={{
        backgroundColor: fondo,
        borderRadius: tema.radios.circular,
        paddingHorizontal: tema.espacios.md,
        paddingVertical: tema.espacios.xs,
        alignSelf: "flex-start",
        flexShrink: 1,
      }}
    >
      <Texto
        variante="etiqueta"
        tono={tono === "neutro" ? "textoSecundario" : tono}
      >
        {texto}
      </Texto>
    </View>
  );
}
