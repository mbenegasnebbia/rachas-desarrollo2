import type { ReactNode } from "react";
import { View } from "react-native";

import { Badge } from "@/components/ui/badge";
import { Boton } from "@/components/ui/boton";
import { Tarjeta } from "@/components/ui/tarjeta";
import { Texto } from "@/components/ui/texto";
import { useEstilos } from "@/theme/estilos";
import type { Desafio } from "@/types";
import { estadoDe, fechaVisible } from "@/utils/fechas";

import { EtiquetasDesafio } from "./etiquetasDesafio";

interface Props {
  desafio: Desafio;
  abrir: () => void;
  children?: ReactNode;
  personaId?: string;
}

export function TarjetaDesafio({
  desafio,
  abrir,
  children,
  personaId,
}: Props) {
  const estilos = useEstilos();

  const estado = estadoDe(desafio);
  return (
    <Tarjeta>
      <View style={estilos.fila}>
        <Badge texto={desafio.categoria} />
        <Badge
          texto={estado}
          tono={
            estado === "ACTIVO"
              ? "exito"
              : estado === "CANCELADO"
                ? "error"
                : estado === "PROGRAMADO"
                  ? "advertencia"
                  : "neutro"
          }
        />
      </View>
      <Texto variante="desafioTitulo">{desafio.nombre}</Texto>
      <Texto variante="cuerpoSecundario" tono="textoSecundario">
        {fechaVisible(desafio.fechaInicio)} — {fechaVisible(desafio.fechaFin)}
      </Texto>
      {personaId && (
        <EtiquetasDesafio desafio={desafio} personaId={personaId} />
      )}
      {children}
      <Boton titulo="Ver desafío" onPress={abrir} secundario />
    </Tarjeta>
  );
}
