import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import type { Desafio } from "@/types";
import { estadoDe, fechaVisible } from "@/utils/fechas";
export const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: "#F6F4F0" },
  contenido: { padding: 20, gap: 16, paddingBottom: 40 },
  titulo: { fontSize: 28, fontWeight: "800", color: "#222C27" },
  subtitulo: { fontSize: 19, fontWeight: "700", color: "#222C27" },
  texto: { fontSize: 15, color: "#4E5B52", lineHeight: 23 },
  tarjeta: {
    padding: 18,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    gap: 10,
    borderWidth: 1,
    borderColor: "#E4E8E1",
  },
  fila: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
  },
  campo: {
    borderWidth: 1,
    borderColor: "#CCD4CA",
    borderRadius: 10,
    padding: 13,
    fontSize: 16,
    color: "#222C27",
    backgroundColor: "#FFF",
  },
  boton: {
    paddingVertical: 13,
    paddingHorizontal: 17,
    borderRadius: 12,
    backgroundColor: "#256448",
    alignItems: "center",
  },
  botonTexto: { color: "#FFF", fontSize: 15, fontWeight: "700" },
  error: { color: "#A32924", fontSize: 15, lineHeight: 22 },
  etiqueta: { fontSize: 13, color: "#4E5B52", fontWeight: "600" },
});
export function Pantalla({
  children,
  refrescar,
  cargando = false,
}: {
  children: ReactNode;
  refrescar?: () => void;
  cargando?: boolean;
}) {
  return (
    <ScrollView
      style={estilos.pantalla}
      contentContainerStyle={estilos.contenido}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        refrescar ? (
          <RefreshControl refreshing={cargando} onRefresh={refrescar} />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  );
}
export function Boton({
  titulo,
  onPress,
  disabled = false,
  secundario = false,
}: {
  titulo: string;
  onPress: () => void;
  disabled?: boolean;
  secundario?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        estilos.boton,
        secundario && { backgroundColor: "#68766B" },
        disabled && { opacity: 0.45 },
      ]}
    >
      <Text style={estilos.botonTexto}>{titulo}</Text>
    </Pressable>
  );
}
export function Campo({
  etiqueta,
  ...props
}: TextInputProps & { etiqueta: string }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={estilos.etiqueta}>{etiqueta}</Text>
      <TextInput
        accessibilityLabel={etiqueta}
        style={estilos.campo}
        {...props}
      />
    </View>
  );
}
export function Aviso({ texto }: { texto: string }) {
  return texto ? (
    <Text accessibilityRole="alert" style={estilos.error}>
      {texto}
    </Text>
  ) : null;
}
export function EstadoCarga({
  cargando,
  error,
  vacio,
  reintentar,
}: {
  cargando: boolean;
  error: string;
  vacio?: boolean;
  reintentar: () => void;
}) {
  return (
    <>
      {cargando && (
        <ActivityIndicator accessibilityLabel="Cargando" color="#256448" />
      )}
      {error ? (
        <View style={estilos.tarjeta}>
          <Aviso texto={error} />
          <Boton titulo="Reintentar" onPress={reintentar} />
        </View>
      ) : !cargando && vacio ? (
        <Text style={estilos.texto}>Todavía no hay datos para mostrar.</Text>
      ) : null}
    </>
  );
}
export function TarjetaDesafio({
  desafio,
  abrir,
  children,
}: {
  desafio: Desafio;
  abrir: () => void;
  children?: ReactNode;
}) {
  return (
    <View style={estilos.tarjeta}>
      <Text style={estilos.etiqueta}>
        {desafio.categoria} · {estadoDe(desafio)}
      </Text>
      <Text style={estilos.subtitulo}>{desafio.nombre}</Text>
      <Text style={estilos.texto}>
        {fechaVisible(desafio.fechaInicio)} — {fechaVisible(desafio.fechaFin)}
      </Text>
      {children}
      <Boton titulo="Ver desafío" onPress={abrir} secundario />
    </View>
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
  return (
    <View style={estilos.fila}>
      {valores.map((v) => (
        <Pressable
          key={v}
          accessibilityRole="button"
          accessibilityState={{ selected: valor === v }}
          onPress={() => cambiar(v)}
          style={{
            padding: 10,
            borderRadius: 10,
            backgroundColor: valor === v ? "#256448" : "#E3E9DF",
          }}
        >
          <Text style={{ color: valor === v ? "#FFF" : "#263B2D" }}>
            {v || "TODOS"}
          </Text>
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
  return (
    <View style={estilos.fila}>
      <Boton
        titulo="Anterior"
        disabled={disabled || pagina <= 1}
        onPress={() => cambiar(pagina - 1)}
      />
      <Text>
        {pagina} / {Math.max(1, paginas)}
      </Text>
      <Boton
        titulo="Siguiente"
        disabled={disabled || pagina >= paginas}
        onPress={() => cambiar(pagina + 1)}
      />
    </View>
  );
}
