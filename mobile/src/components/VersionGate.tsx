import { useAnalytics } from "@/analytics/AnalyticsProvider";
import { track, analyticsContext } from "@/analytics/runtime";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState, Linking, Platform, Text, View } from "react-native";
import { API_URL } from "@/api/client";
import {
  APP_VERSION,
  appHeaders,
  compareVersions,
  isPolicy,
  onUpgrade,
  type VersionPolicy,
} from "@/api/version";
import { Boton, estilos, Pantalla } from "./UI";

export function VersionGate({ children }: { children: ReactNode }) {
  const analytics = useAnalytics();
  const shown = useRef(new Set<string>());
  const [policy, setPolicy] = useState<VersionPolicy | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState("");
  const [forced, setForced] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      if (!API_URL) throw new Error();
      // Public discovery: no Firebase token, no session/profile creation.
      const response = await fetch(
        API_URL.replace(/\/$/, "") + "/version-policy",
        {
          headers: appHeaders(),
          signal: controller.signal,
          cache: "no-store",
          credentials: "omit",
          redirect: "error",
        },
      );
      const data: unknown = await response.json();
      if (!response.ok || !isPolicy(data)) throw new Error();
      setPolicy(data);
      setForced(compareVersions(APP_VERSION, data.minimumVersion) < 0);
    } catch {
      setError(
        "No pudimos consultar la política de actualización. Revisá la conexión y reintentá.",
      );
    } finally {
      clearTimeout(timer);
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    const initial = setTimeout(() => {
      void load();
    }, 0);
    const stop = onUpgrade((data) => {
      setPolicy(data);
      setForced(true);
    });
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void load();
    });
    return () => {
      clearTimeout(initial);
      stop();
      sub.remove();
    };
  }, [load]);
  const mandatory =
    forced ||
    (!!policy && compareVersions(APP_VERSION, policy.minimumVersion) < 0);
  const recommended =
    !!policy && compareVersions(APP_VERSION, policy.recommendedVersion) < 0;
  useEffect(() => {
    if (!policy || !analytics.ready || !analytics.enabled || analytics.busy)
      return;
    const type = mandatory
      ? "obligatoria"
      : recommended && dismissed !== policy.recommendedVersion
        ? "recomendada"
        : null;
    if (!type) return;
    const target = mandatory
      ? policy.minimumVersion
      : policy.recommendedVersion;
    const key = `${analyticsContext()}:${type}:${target}`;
    if (shown.current.has(key)) return;
    shown.current.add(key);
    track("aviso_actualizacion_mostrado", {
      tipo: type,
      version_objetivo: target,
    });
  }, [
    policy,
    mandatory,
    recommended,
    dismissed,
    analytics.ready,
    analytics.enabled,
    analytics.busy,
  ]);
  const update = async () => {
    try {
      if (policy?.updateUrl) await Linking.openURL(policy.updateUrl);
      else if (Platform.OS === "web" && typeof window !== "undefined")
        window.location.reload();
      else setError("Solicitá el build actualizado al responsable de Rachas.");
    } catch {
      setError(
        "No se pudo abrir la actualización. Consultá las instrucciones e intentá de nuevo.",
      );
    }
  };
  if (mandatory || !policy)
    return (
      <Pantalla>
        <Text style={estilos.titulo}>
          {mandatory
            ? "Actualizá Rachas para continuar"
            : "Comprobando versión"}
        </Text>
        <Text style={estilos.texto}>Versión instalada: {APP_VERSION}</Text>
        {policy && (
          <Text style={estilos.texto}>
            Mínima: {policy.minimumVersion}. {policy.instructions}
          </Text>
        )}
        {!!error && (
          <Text accessibilityRole="alert" style={estilos.error}>
            {error}
          </Text>
        )}
        {mandatory && (
          <Boton
            titulo="Actualizar"
            onPress={() => {
              void update();
            }}
          />
        )}
        <Boton
          titulo={loading ? "Consultando…" : "Volver a comprobar"}
          disabled={loading}
          onPress={() => {
            void load();
          }}
        />
      </Pantalla>
    );
  return (
    <View style={{ flex: 1 }}>
      {recommended && dismissed !== policy.recommendedVersion && (
        <View style={estilos.tarjeta}>
          <Text style={estilos.texto}>
            Hay una nueva versión de Rachas: {policy.recommendedVersion}.
          </Text>
          <Boton
            titulo="Actualizar"
            onPress={() => {
              void update();
            }}
          />
          <Boton
            titulo="Más tarde"
            secundario
            onPress={() => setDismissed(policy.recommendedVersion)}
          />
          {!!error && <Text style={estilos.error}>{error}</Text>}
        </View>
      )}
      {children}
    </View>
  );
}
