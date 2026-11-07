import { View } from "react-native";

import { useTema } from "@/theme/useTema";

import { Texto } from "./texto";

interface Props {
  titulo: string;
  descripcion?: string;
  principal?: boolean;
  descripcionVariante?: "cuerpo" | "cuerpoSecundario";
  variante?:
    | "pantallaTitulo"
    | "desafioTitulo"
    | "seccionTitulo"
    | "seccionDestacada"
    | "tarjetaTitulo";
}

export function Encabezado({
  titulo,
  descripcion,
  principal = false,
  variante,
  descripcionVariante = "cuerpo",
}: Props) {
  const tema = useTema();

  return (
    <View style={{ gap: tema.espacios.sm }}>
      <Texto
        accessibilityRole="header"
        variante={variante ?? (principal ? "pantallaTitulo" : "seccionTitulo")}
      >
        {titulo}
      </Texto>
      {descripcion && (
        <Texto variante={descripcionVariante} tono="textoSecundario">
          {descripcion}
        </Texto>
      )}
    </View>
  );
}
