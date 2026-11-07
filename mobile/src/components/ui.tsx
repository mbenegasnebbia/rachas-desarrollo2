import { ActivityIndicator, Pressable, View } from "react-native";

import { Boton } from "@/components/ui/boton";
import { EstadoVacio } from "@/components/ui/estadoVacio";
import { Tarjeta } from "@/components/ui/tarjeta";
import { Texto } from "@/components/ui/texto";
import { useEstilos } from "@/theme/estilos";
import { useTema } from "@/theme/useTema";

export { estilos, useEstilos } from "@/theme/estilos";
export { Pantalla } from "@/components/ui/pantalla";
export { Campo } from "@/components/ui/campo";
export { Boton, Boton as BotonVisual } from "@/components/ui/boton";
export { Tarjeta } from "@/components/ui/tarjeta";
export { Texto } from "@/components/ui/texto";
export { Encabezado } from "@/components/ui/encabezado";
export { Badge } from "@/components/ui/badge";
export { IconoCircular } from "@/components/ui/iconoCircular";
export { Estadistica } from "@/components/ui/estadistica";
export { Seccion } from "@/components/ui/seccion";
export { SeccionExpandible } from "@/components/ui/seccionExpandible";

export function Aviso({ texto }: { texto: string }) {
  const tema = useTema();

  return texto ? (
    <View
      style={{
        backgroundColor: tema.colores.fondoError,
        padding: tema.espacios.lg,
        borderRadius: tema.radios.control,
      }}
    >
      <Texto accessibilityRole="alert" tono="error">
        {texto}
      </Texto>
    </View>
  ) : null;
}
export function EstadoCarga({
  cargando,
  error,
  vacio,
  mensajeVacio = "Todavía no hay datos para mostrar.",
  reintentar,
}: {
  cargando: boolean;
  error: string;
  vacio?: boolean;
  mensajeVacio?: string;
  reintentar: () => void;
}) {
  const tema = useTema();

  return (
    <>
      {cargando && (
        <ActivityIndicator
          accessibilityLabel="Cargando"
          color={tema.colores.texto}
        />
      )}
      {error ? (
        <Tarjeta>
          <Aviso texto={error} />
          <Boton titulo="Reintentar" onPress={reintentar} />
        </Tarjeta>
      ) : !cargando && vacio ? (
        <EstadoVacio mensaje={mensajeVacio} />
      ) : null}
    </>
  );
}
export function Opciones<T extends string>({
  valores,
  valor,
  cambiar,
}: {
  valores: readonly T[];
  valor: T;
  cambiar: (v: T) => void;
}) {
  const tema = useTema();
  const estilos = useEstilos();

  return (
    <View style={estilos.fila}>
      {valores.map((v) => (
        <Pressable
          key={v}
          accessibilityRole="button"
          accessibilityState={{ selected: valor === v }}
          onPress={() => cambiar(v)}
          style={{
            paddingVertical: tema.espacios.sm,
            paddingHorizontal: tema.espacios.md,
            borderWidth: tema.interaccion.borde,
            borderColor:
              valor === v ? tema.colores.texto : tema.colores.transparente,
            minHeight: tema.medidas.toqueMinimo,
            justifyContent: "center",
            borderRadius: tema.radios.circular,
            backgroundColor:
              valor === v
                ? tema.colores.primario
                : tema.colores.superficieSuave,
          }}
        >
          <Texto
            style={{
              color:
                valor === v ? tema.colores.sobrePrimario : tema.colores.texto,
            }}
          >
            {v || "TODOS"}
          </Texto>
        </Pressable>
      ))}
    </View>
  );
}
export function Paginador({
  pagina,
  paginas,
  cambiar,
  disabled,
}: {
  pagina: number;
  paginas: number;
  cambiar: (p: number) => void;
  disabled: boolean;
}) {
  const estilos = useEstilos();

  return (
    <View style={estilos.fila}>
      <Boton
        titulo="Anterior"
        disabled={disabled || pagina <= 1}
        onPress={() => cambiar(pagina - 1)}
      />
      <Texto style={estilos.texto}>
        {pagina} / {Math.max(1, paginas)}
      </Texto>
      <Boton
        titulo="Siguiente"
        disabled={disabled || pagina >= paginas}
        onPress={() => cambiar(pagina + 1)}
      />
    </View>
  );
}
