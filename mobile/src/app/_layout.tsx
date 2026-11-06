import { VersionGate } from "@/components/VersionGate";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SesionProvider } from "@/session/Sesion";
export default function RootLayout() {
  return (
    <VersionGate>
      <SesionProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: "#F6F4F0" },
            headerTintColor: "#256448",
            contentStyle: { backgroundColor: "#F6F4F0" },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen
            name="ingreso"
            options={{ title: "Rachas · Ingreso" }}
          />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="desafio/[id]"
            options={{ title: "Detalle del desafío" }}
          />
        </Stack>
      </SesionProvider>
    </VersionGate>
  );
}
