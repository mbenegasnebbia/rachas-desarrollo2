import { Redirect, Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EstadoCarga, Pantalla } from "@/components/ui";
import { IconoCircular } from "@/components/ui/iconoCircular";
import { useSesion } from "@/session/sesion";
import { useTema } from "@/theme/useTema";

export default function Principal() {
  const tema = useTema();

  const insets = useSafeAreaInsets();
  const s = useSesion();
  if (s.cargando)
    return (
      <Pantalla>
        <EstadoCarga
          cargando={s.cargando}
          error={s.error}
          reintentar={s.reintentar}
        />
      </Pantalla>
    );
  if (!s.persona?.perfilCompleto) return <Redirect href="/ingreso" />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: tema.colores.iconoSobreAcento,
        tabBarInactiveTintColor: tema.colores.textoSecundario,
        tabBarActiveBackgroundColor: tema.colores.transparente,
        tabBarHideOnKeyboard: true,
        tabBarItemStyle: { alignItems: "center", justifyContent: "center" },
        tabBarIconStyle: {
          width: tema.circulos.navegacion,
          height: tema.circulos.navegacion,
        },
        tabBarStyle: {
          backgroundColor: tema.colores.superficie,
          borderTopColor: tema.colores.borde,
          borderTopLeftRadius: tema.radios.tarjeta,
          borderTopRightRadius: tema.radios.tarjeta,
          height: tema.medidas.altoBarra + insets.bottom,
          paddingBottom: Math.max(insets.bottom, tema.espacios.sm),
          paddingTop: tema.espacios.sm,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Inicio",
          tabBarAccessibilityLabel: "Inicio",
          tabBarIcon: ({ focused }) => (
            <IconoCircular
              icono="inicio"
              tono="acento"
              tamano="navegacion"
              variante={focused ? "solido" : "sinFondo"}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="explorar"
        options={{
          title: "Explorar",
          tabBarAccessibilityLabel: "Explorar",
          tabBarIcon: ({ focused }) => (
            <IconoCircular
              icono="explorar"
              tono="acento"
              tamano="navegacion"
              variante={focused ? "solido" : "sinFondo"}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="crear"
        options={{
          title: "Crear",
          tabBarAccessibilityLabel: "Crear",
          tabBarIcon: ({ focused }) => (
            <IconoCircular
              icono="crear"
              tono="acento"
              tamano="navegacion"
              variante={focused ? "solido" : "sinFondo"}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: "Perfil",
          tabBarAccessibilityLabel: "Perfil",
          tabBarIcon: ({ focused }) => (
            <IconoCircular
              icono="perfil"
              tono="acento"
              tamano="navegacion"
              variante={focused ? "solido" : "sinFondo"}
            />
          ),
        }}
      />
    </Tabs>
  );
}
