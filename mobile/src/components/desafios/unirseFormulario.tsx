import { useState } from "react";
import { View } from "react-native";

import { unirse } from "@/api/desafios";
import { Aviso, Boton, Campo, useEstilos } from "@/components/ui";
import { IconoCircular } from "@/components/ui/iconoCircular";
import { Texto } from "@/components/ui/texto";
import { useAccion } from "@/hooks/useCarga";
import type { Desafio } from "@/types";

interface Props {
  codigoEsperado?: string;
  disabled?: boolean;
  alUnirse: (desafio: Desafio) => Promise<void> | void;
}

export function UnirseFormulario({
  codigoEsperado,
  disabled = false,
  alUnirse,
}: Props) {
  const estilos = useEstilos();

  const [codigo, setCodigo] = useState("");
  const accion = useAccion();
  return (
    <View style={estilos.tarjeta}>
      <IconoCircular icono="llave" tono="secundario" variante="suave" />
      <Texto variante="tarjetaTitulo">Unirme con invitación</Texto>
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
