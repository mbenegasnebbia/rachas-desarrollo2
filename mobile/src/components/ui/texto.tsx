import { createContext, useContext } from "react";
import { Text, type TextProps } from "react-native";

import type { tema } from "@/theme";
import { useTema } from "@/theme/useTema";

export const FuentesCargadas = createContext(false);
type Props = TextProps & {
  variante?: keyof typeof tema.tipografia;
  tono?: keyof typeof tema.colores;
};
export function Texto({
  variante = "cuerpo",
  tono = "texto",
  style,
  ...props
}: Props) {
  const tema = useTema();

  const cargadas = useContext(FuentesCargadas);
  const fuente = tema.tipografia[variante];
  return (
    <Text
      {...props}
      style={[
        fuente,
        {
          color: tema.colores[tono],
          fontFamily: cargadas ? fuente.fontFamily : undefined,
        },
        style,
        !cargadas && { fontFamily: undefined },
      ]}
    />
  );
}
