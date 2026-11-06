import { Redirect, Tabs } from "expo-router";
import { useSesion } from "@/session/Sesion";
import { EstadoCarga, Pantalla } from "@/components/UI";
export default function Principal() {
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
        tabBarActiveTintColor: "#256448",
        tabBarIcon: () => null,
        tabBarIconStyle: { display: "none" },
        tabBarLabelStyle: { fontSize: 14, fontWeight: "600" },
        tabBarItemStyle: { paddingVertical: 10 },
        headerStyle: { backgroundColor: "#F6F4F0" },
        tabBarStyle: { backgroundColor: "#FFF" },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Inicio" }} />
      <Tabs.Screen name="explorar" options={{ title: "Explorar" }} />
      <Tabs.Screen name="crear" options={{ title: "Crear" }} />
      <Tabs.Screen name="perfil" options={{ title: "Perfil" }} />
    </Tabs>
  );
}
