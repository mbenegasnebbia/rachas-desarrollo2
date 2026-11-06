import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { request, ApiError } from "@/api/client";
import { APP_VERSION } from "@/api/version";
import { AnalyticsQueue, type Properties } from "./queue";

interface State {
  enabled: boolean;
  ready: boolean;
  busy: boolean;
  error: string;
}
let state: State = { enabled: false, ready: false, busy: false, error: "" };
const listeners = new Set<(value: State) => void>();
let owner: string | null = null,
  generation = 0,
  pumping = false,
  needsConsent = false;
const optOut = (uid: string) => "rachas.analytics.optout." + uid;
function publish(value: Partial<State>) {
  state = { ...state, ...value };
  listeners.forEach((listener) => listener(state));
}
const queue = new AnalyticsQueue(
  AsyncStorage,
  async (events, uid) => {
    try {
      const response = await request<{ acceptedIds: string[] }>(
        "/analytics/events",
        { method: "POST", body: { events }, expectedUid: uid },
      );
      return response.acceptedIds;
    } catch (error) {
      if (error instanceof ApiError && error.status === 400)
        return events.map((event) => event.eventId);
      if (error instanceof ApiError && error.status === 403 && owner === uid) {
        queue.revoke();
        publish({
          enabled: false,
          error: "Compartir datos de uso está desactivado en el servidor.",
        });
      }
      throw error;
    }
  },
  () => globalThis.crypto.randomUUID(),
  { appVersion: APP_VERSION, platform: Platform.OS },
);

export const analyticsState = () => state;
export function subscribeAnalytics(listener: (value: State) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export async function connectAnalytics(uid: string | null) {
  const turn = ++generation;
  owner = uid;
  needsConsent = !!uid;
  publish({ enabled: false, ready: false, busy: false, error: "" });
  // Disable delivery immediately; preserve this account's durable queue until consent is known.
  await queue.open(uid, true);
  if (turn !== generation) return;
  if (!uid) {
    publish({ ready: true });
    return;
  }
  try {
    const pending = await AsyncStorage.getItem(optOut(uid));
    if (pending === "1") {
      queue.revoke();
      await request("/analytics/consent", {
        method: "PATCH",
        body: { enabled: false },
        expectedUid: uid,
      });
      await AsyncStorage.removeItem(optOut(uid));
    }
    const preference = await request<{ enabled: boolean }>(
      "/analytics/consent",
      { expectedUid: uid },
    );
    if (turn !== generation) return;
    await queue.open(uid, preference.enabled === true);
    if (turn !== generation) return;
    needsConsent = false;
    publish({ enabled: preference.enabled === true, ready: true });
    if (preference.enabled) track("ingreso_exitoso", {}, turn);
  } catch {
    if (turn !== generation) return;
    queue.suspend();
    publish({
      enabled: false,
      ready: true,
      error:
        "No se pudo confirmar el consentimiento. Analytics permanece apagado.",
    });
  }
}
export async function setAnalyticsConsent(enabled: boolean) {
  if (!owner || state.busy) return;
  const uid = owner,
    turn = ++generation;
  queue.revoke();
  publish({ enabled: false, busy: true, error: "" });
  try {
    if (!enabled) await AsyncStorage.setItem(optOut(uid), "1");
    await request("/analytics/consent", {
      method: "PATCH",
      body: { enabled },
      expectedUid: uid,
    });
    await AsyncStorage.removeItem(optOut(uid));
    if (turn !== generation) return;
    await queue.open(uid, enabled);
    if (turn === generation) publish({ enabled, ready: true });
  } catch {
    if (turn === generation)
      publish({
        enabled: false,
        ready: true,
        error: enabled
          ? "No se pudo activar. No se compartirán eventos."
          : "Desactivado en este dispositivo. Reintentaremos sincronizar al recuperar conexión.",
      });
  } finally {
    if (turn === generation) publish({ busy: false });
  }
}
export const analyticsContext = () => generation;
export function suspendAnalytics() {
  generation++;
  owner = null;
  queue.suspend();
  publish({ enabled: false, ready: false, busy: false });
}
export function track<N extends keyof Properties>(
  name: N,
  properties: Properties[N],
  context = generation,
) {
  if (context === generation && state.enabled && state.ready && !state.busy)
    queue.track(name, properties);
}
export function observeStreaks(
  items: { desafio: { id: string }; rachaActual: number }[],
  day: string,
  context = generation,
) {
  try {
    if (context === generation && state.enabled && state.ready && !state.busy)
      queue.observe(items, day);
  } catch {
    /* malformed analytics input must not affect the API result */
  }
}
export async function flushAnalytics() {
  if (pumping || !owner || state.busy || !state.ready) return;
  pumping = true;
  const uid = owner,
    turn = generation;
  try {
    if (needsConsent) {
      await connectAnalytics(uid);
      return;
    }
    if ((await AsyncStorage.getItem(optOut(uid))) === "1") {
      queue.revoke();
      publish({ enabled: false });
      await request("/analytics/consent", {
        method: "PATCH",
        body: { enabled: false },
        expectedUid: uid,
      });
      await AsyncStorage.removeItem(optOut(uid));
      if (turn === generation) publish({ enabled: false, error: "" });
    }
    if (turn === generation && state.enabled) await queue.flush();
  } catch {
    /* bounded queue remains for a later attempt */
  } finally {
    pumping = false;
  }
}
