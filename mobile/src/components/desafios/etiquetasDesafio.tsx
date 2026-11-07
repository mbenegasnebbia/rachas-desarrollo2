import { View } from "react-native";

import { Badge } from "@/components/ui/badge";
import { useEstilos } from "@/theme/estilos";
import type { Desafio } from "@/types";
import { estadoDe } from "@/utils/fechas";

interface Props {
  desafio: Desafio;
  personaId?: string;
}

export function EtiquetasDesafio({
  desafio,
  personaId,
}: Props) {
  const estilos = useEstilos();

  const estado = estadoDe(desafio);
  const participa = !!personaId && desafio.participantes.includes(personaId);
  const abandono = !!personaId && desafio.exParticipantes.includes(personaId);
  const cerrado = estado === "FINALIZADO" || estado === "CANCELADO";
  const completo = desafio.participantes.length >= desafio.maxParticipantes;
  return (
    <View style={estilos.fila}>
      {[
        desafio.creador === personaId
          ? "Creado por vos"
          : participa
            ? "Ya participás"
            : "",
        cerrado
          ? estado === "FINALIZADO"
            ? "Desafío finalizado"
            : "Desafío cancelado"
          : abandono
            ? "Abandonaste este desafío · No podés volver a unirte"
            : completo
              ? "Desafío completo"
              : !participa
                ? "Con cupo · Unión con código sujeta a validación"
                : "",
      ]
        .filter(Boolean)
        .map((texto) => (
          <Badge key={texto} texto={texto} />
        ))}
    </View>
  );
}
