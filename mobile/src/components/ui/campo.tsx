import { useContext, useState } from "react";
import { TextInput, View, type TextInputProps } from "react-native";

import { useEstilos } from "@/theme/estilos";
import { useTema } from "@/theme/useTema";

import { Texto, FuentesCargadas } from "./texto";

type Props = TextInputProps & { etiqueta: string };

export function Campo({
  etiqueta,
  onFocus,
  onBlur,
  style,
  ...props
}: Props) {
  const tema = useTema();
  const estilos = useEstilos();

  const fuentes = useContext(FuentesCargadas);
  const [foco, setFoco] = useState(false);
  return (
    <View style={{ gap: tema.espacios.sm }}>
      <Texto variante="etiqueta">{etiqueta}</Texto>
      <TextInput
        {...props}
        accessibilityLabel={props.accessibilityLabel ?? etiqueta}
        placeholderTextColor={tema.colores.textoSecundario}
        onFocus={(e) => {
          setFoco(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFoco(false);
          onBlur?.(e);
        }}
        style={[
          estilos.campo,
          props.multiline && { textAlignVertical: "top" },
          {
            borderColor: foco ? tema.colores.foco : tema.colores.borde,
            backgroundColor:
              props.editable === false
                ? tema.colores.fondoDeshabilitado
                : tema.colores.superficie,
          },
          style,
          !fuentes && { fontFamily: undefined },
        ]}
      />
    </View>
  );
}
