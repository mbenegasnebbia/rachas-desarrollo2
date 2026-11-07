import { View } from "react-native";

import { useTema } from "@/theme/useTema";

import type { NombreIcono } from "./icono";
import { IconoCircular } from "./iconoCircular";
import { Texto } from "./texto";

interface Props {
  valor: string | number;
  etiqueta: string;
  icono?: NombreIcono;
  destacada?: boolean;
}

export function Estadistica({
  valor,
  etiqueta,
  icono,
}: Props) {
  const tema = useTema();

  return (
    <View
      style={{
        gap: tema.espacios.xs,
        flexGrow: 1,
        flexBasis: tema.medidas.baseEstadistica,
      }}
    >
      {icono && (
        <IconoCircular
          icono={icono}
          tono={
            icono === "fuego"
              ? "acento"
              : icono === "trofeo"
                ? "secundario"
                : "primario"
          }
          tamano="pequeno"
        />
      )}
      <Texto variante="estadistica">{valor}</Texto>
      <Texto variante="etiqueta" tono="textoSecundario">
        {etiqueta}
      </Texto>
    </View>
  );
}
