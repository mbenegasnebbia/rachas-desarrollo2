import { useState, type ReactNode } from "react";
import { View } from "react-native";

import { useTema } from "@/theme/useTema";

import { ControlDesplegable } from "./controlDesplegable";
import { Tarjeta } from "./tarjeta";

interface Props {
  titulo: string;
  resumen?: string;
  inicialmenteExpandida?: boolean;
  children: ReactNode;
}

export function SeccionExpandible({
  titulo,
  resumen,
  inicialmenteExpandida = false,
  children,
}: Props) {
  const tema = useTema();
  const [expandido, setExpandido] = useState(inicialmenteExpandida);
  return (
    <Tarjeta>
      <ControlDesplegable
        titulo={titulo}
        resumen={resumen}
        expandido={expandido}
        onPress={() => setExpandido((v) => !v)}
      />
      {expandido && <View style={{ gap: tema.espacios.sm }}>{children}</View>}
    </Tarjeta>
  );
}
