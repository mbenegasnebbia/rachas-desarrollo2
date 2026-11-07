import { View } from "react-native";

import { IconoCircular } from "@/components/ui/iconoCircular";
import { Texto } from "@/components/ui/texto";
import { useTema } from "@/theme/useTema";

interface Props {
  racha: number;
  puntos: number;
  puesto: number;
}
// Display-only: preserves the values received from each screen.
export function ResumenMetricas({ racha, puntos, puesto }: Props) {
  const tema = useTema();
  const metricas = [
    { etiqueta: "RACHA", valor: racha, icono: "fuego", tono: "acento" },
    { etiqueta: "PUNTOS", valor: puntos, icono: "puntos", tono: "primario" },
    { etiqueta: "PUESTO", valor: puesto, icono: "trofeo", tono: "secundario" },
  ] as const;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "stretch",
        gap: tema.espacios.sm,
        padding: tema.espacios.md,
        backgroundColor: tema.colores.superficieSuave,
        borderRadius: tema.radios.control,
      }}
    >
      {metricas.map((metrica) => (
        <View
          key={metrica.etiqueta}
          style={{
            flexGrow: 1,
            flexShrink: 1,
            flexBasis: 0,
            minWidth: 0,
            alignItems: "center",
            gap: tema.espacios.xs,
          }}
        >
          <IconoCircular
            icono={metrica.icono}
            tono={metrica.tono}
            tamano="metrica"
            tinta="tono"
          />
          <Texto variante="metricaNumero" style={{ textAlign: "center" }}>
            {metrica.valor}
          </Texto>
          <Texto
            variante="metricaEtiqueta"
            tono="textoSecundario"
            style={{ textAlign: "center" }}
          >
            {metrica.etiqueta}
          </Texto>
        </View>
      ))}
    </View>
  );
}
