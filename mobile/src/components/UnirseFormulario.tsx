import { useState } from "react";
import { Text, View } from "react-native";
import { unirse } from "@/api/desafios";
import { useAccion } from "@/hooks/useCarga";
import type { Desafio } from "@/types";
import { Aviso, Boton, Campo, estilos } from "./UI";

export function UnirseFormulario({
  codigoEsperado,
  disabled = false,
  alUnirse,
}: {
  codigoEsperado?: string;
  disabled?: boolean;
  alUnirse: (desafio: Desafio) => Promise<void> | void;
}) {
  const [codigo, setCodigo] = useState("");
  const accion = useAccion();
  return (
    <View style={estilos.tarjeta}>
      <Text style={estilos.subtitulo}>Unirme con invitación</Text>
      <Campo
        etiqueta="Código de invitación"
        autoCapitalize="characters"
        maxLength={6}
        editable={!accion.ocupado && !disabled}
        value={codigo}
        onChangeText={(texto) => {
          setCodigo(texto);
          accion.limpiarError();
        }}
      />
      <Aviso texto={accion.error} />
      <Boton
        titulo={accion.ocupado ? "Uniéndome…" : "Unirme"}
        disabled={disabled || accion.ocupado}
        onPress={() =>
          void accion.ejecutar(async () => {
            const normalizado = codigo.trim().toUpperCase();
            if (!/^[A-Z0-9]{6}$/.test(normalizado))
              throw new Error("Ingresá un código de 6 letras o números.");
            if (codigoEsperado && normalizado !== codigoEsperado.toUpperCase())
              throw new Error("El código no corresponde a este desafío.");
            const desafio = await unirse(normalizado);
            setCodigo("");
            await alUnirse(desafio);
          })
        }
      />
    </View>
  );
}
