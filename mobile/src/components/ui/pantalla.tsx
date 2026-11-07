import type { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useEstilos } from "@/theme/estilos";
import { useTema } from "@/theme/useTema";

interface Props {
  children: ReactNode;
  refrescar?: () => void;
  cargando?: boolean;
}

export function Pantalla({
  children,
  refrescar,
  cargando = false,
}: Props) {
  const tema = useTema();
  const estilos = useEstilos();

  return (
    <SafeAreaView
      edges={["top", "left", "right", "bottom"]}
      style={estilos.pantalla}
    >
      <KeyboardAvoidingView
        style={estilos.pantalla}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={estilos.contenido}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          refreshControl={
            refrescar ? (
              <RefreshControl
                refreshing={cargando}
                onRefresh={refrescar}
                tintColor={tema.colores.texto}
                colors={[tema.colores.texto]}
              />
            ) : undefined
          }
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
