import { PlusJakartaSans_400Regular } from "@expo-google-fonts/plus-jakarta-sans/400Regular";
import { PlusJakartaSans_600SemiBold } from "@expo-google-fonts/plus-jakarta-sans/600SemiBold";
import { PlusJakartaSans_700Bold } from "@expo-google-fonts/plus-jakarta-sans/700Bold";
import { PlusJakartaSans_800ExtraBold } from "@expo-google-fonts/plus-jakarta-sans/800ExtraBold";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { AnalyticsProvider } from "@/analytics/analyticsProvider";
import { VersionGate } from "@/components/versionGate";
import { FuentesCargadas } from "@/components/ui/texto";
import { SesionProvider } from "@/session/sesion";
import { useTema } from "@/theme/useTema";

export default function RootLayout() {
  const tema = useTema();

  const [fuentes] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });
  return (
    <FuentesCargadas.Provider value={fuentes}>
      <AnalyticsProvider>
        <VersionGate>
          <SesionProvider>
            <StatusBar style="dark" />
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: tema.colores.fondo },
                headerTintColor: tema.colores.texto,
                headerTitleStyle: {
                  ...tema.tipografia.etiqueta,
                  fontFamily: fuentes
                    ? tema.tipografia.etiqueta.fontFamily
                    : undefined,
                },
                headerShadowVisible: false,
                contentStyle: { backgroundColor: tema.colores.fondo },
              }}
            >
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen
                name="ingreso"
                options={{ title: "Rachas", headerShown: false }}
              />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen
                name="desafio/[id]"
                options={{ title: "", headerBackTitle: "Volver" }}
              />
            </Stack>
          </SesionProvider>
        </VersionGate>
      </AnalyticsProvider>
    </FuentesCargadas.Provider>
  );
}
