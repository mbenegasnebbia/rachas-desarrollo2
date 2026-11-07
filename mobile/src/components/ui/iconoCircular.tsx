import { View } from "react-native";

import type { tema } from "@/theme";
import { useTema } from "@/theme/useTema";

import { Icono, type NombreIcono } from "./icono";

interface Props {
  icono?: NombreIcono;
  tono?: "primario" | "secundario" | "acento";
  tamano?: keyof typeof tema.circulos;
  variante?: "solido" | "suave" | "sinFondo";
  tinta?: "uniforme" | "tono";
}

export function IconoCircular({
  icono = "fuego",
  tono = "acento",
  tamano = "mediano",
  variante = "solido",
  tinta = "uniforme",
}: Props) {
  const tema = useTema();

  const suave =
    tono === "primario"
      ? tema.colores.fondoPrimarioSuave
      : tono === "secundario"
        ? tema.colores.fondoSecundarioSuave
        : tema.colores.fondoAcentoSuave;
  const fondo =
    variante === "solido"
      ? tema.colores[tono]
      : variante === "suave"
        ? suave
        : tema.colores.transparente;
  const colorIcono =
    variante === "sinFondo"
      ? tema.colores.textoSecundario
      : tinta === "tono"
        ? tono === "acento"
          ? tema.colores.iconoSobreAcento
          : tono === "primario"
            ? tema.colores.iconoSobrePrimario
            : tema.colores.iconoSobreSecundario
        : variante === "solido"
          ? tema.colores.sobrePrimario
          : tema.colores.texto;
  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: tema.circulos[tamano],
        height: tema.circulos[tamano],
        flexShrink: 0,
        borderRadius: tema.radios.circular,
        backgroundColor: fondo,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Icono nombre={icono} size={tema.iconos[tamano]} color={colorIcono} />
    </View>
  );
}
