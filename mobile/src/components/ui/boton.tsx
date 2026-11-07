import { useState } from "react";
import { ActivityIndicator, Pressable } from "react-native";

import { useTema } from "@/theme/useTema";

import { Texto } from "./texto";

interface Props {
  titulo: string;
  onPress: () => void;
  variante?: "primario" | "secundario" | "peligro";
  disabled?: boolean;
  cargando?: boolean;
  secundario?: boolean;
  accessibilityLabel?: string;
}
export function Boton({
  titulo,
  onPress,
  variante,
  secundario = false,
  accessibilityLabel,
  disabled = false,
  cargando = false,
}: Props) {
  const tema = useTema();

  const [foco, setFoco] = useState(false);
  const tipo = variante ?? (secundario ? "secundario" : "primario");
  const bloqueado = disabled || cargando;
  const fondo = bloqueado
    ? tema.colores.fondoDeshabilitado
    : tipo === "primario"
      ? tema.colores.primario
      : tipo === "peligro"
        ? tema.colores.destructivo
        : tema.colores.superficie;
  const tono = bloqueado
    ? "textoDeshabilitado"
    : tipo === "primario"
      ? "sobrePrimario"
      : tipo === "peligro"
        ? "sobreDestructivo"
        : "texto";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onFocus={() => setFoco(true)}
      onBlur={() => setFoco(false)}
      accessibilityState={{ disabled: bloqueado, busy: cargando }}
      disabled={bloqueado}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: tema.medidas.altoBoton,
        paddingVertical: tema.espacios.md,
        paddingHorizontal: tema.espacios.xl,
        borderRadius: tema.radios.circular,
        backgroundColor: fondo,
        borderWidth: foco ? tema.interaccion.bordeFoco : tema.interaccion.borde,
        borderColor: foco
          ? tema.colores.foco
          : tipo === "secundario"
            ? tema.colores.borde
            : fondo,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: tema.espacios.sm,
        opacity: pressed ? tema.interaccion.opacidadPresionado : 1,
      })}
    >
      {cargando && <ActivityIndicator color={tema.colores[tono]} />}
      <Texto
        variante="boton"
        tono={tono}
        style={{ textAlign: "center", flexShrink: 1 }}
      >
        {titulo}
      </Texto>
    </Pressable>
  );
}
