import { View, type ViewProps } from "react-native";

import { useTema } from "@/theme/useTema";

type Props = ViewProps & { tono?: "superficie" | "primario" | "secundario" };

export function Tarjeta({
  tono = "superficie",
  style,
  ...props
}: Props) {
  const tema = useTema();

  return (
    <View
      {...props}
      style={[
        {
          borderWidth: tema.interaccion.borde,
          borderColor: tema.colores.borde,
          backgroundColor: tema.colores[tono],
          borderRadius: tema.radios.tarjeta,
          padding: tema.medidas.paddingTarjeta,
          gap: tema.espacios.md,
        },
        style,
      ]}
    />
  );
}
