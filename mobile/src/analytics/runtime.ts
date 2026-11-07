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
const pendingRevocations = new Set<string>();
let webLease: Promise<boolean> | undefined;
function acquireLease(): Promise<boolean> {
  if (Platform.OS !== "web" || typeof window === "undefined")
    return Promise.resolve(true);
  if (!webLease)
    webLease = new Promise((resolve) => {
      if (!navigator.locks) {
        resolve(false);
        return;
      }
      void navigator.locks
        .request(
          "rachas.analytics.owner",
          { ifAvailable: true },
          async (lock) => {
            resolve(!!lock);
            if (lock) await new Promise<void>(() => {}); // held until this document closes
          },
        )
        .catch(() => resolve(false));
    });
  return webLease;
}
const current = (uid: string, turn: number) =>
  owner === uid && generation === turn;
const optOut = (uid: string) => "rachas.analytics.optout." + uid;
function publish(value: Partial<State>) {
  state = { ...state, ...value };
  listeners.forEach((listener) => listener(state));
}
const queue = new AnalyticsQueue(
  AsyncStorage,
  async (events, uid) => {
    const turn = generation;
    const deliver = async (batch: typeof events): Promise<string[]> => {
      if (!current(uid, turn)) throw new Error("Stale analytics operation");
      try {
        const response = await request<{ acceptedIds: string[] }>(
          "/analytics/events",
          { method: "POST", body: { events: batch }, expectedUid: uid },
        );
        return response.acceptedIds;
      } catch (error) {
        if (error instanceof ApiError && error.status === 400) {
          if (!current(uid, turn)) throw error;
          if (batch.length === 1) return [batch[0].eventId]; // terminal rejection, isolated
          const middle = Math.floor(batch.length / 2);
          const left = await deliver(batch.slice(0, middle));
          const right = await deliver(batch.slice(middle));
          return [...left, ...right];
        }
        if (
          error instanceof ApiError &&
          error.status === 403 &&
          current(uid, turn)
        ) {
          queue.revoke();
          publish({
            enabled: false,
            error: "Compartir datos de uso está desactivado en el servidor.",
          });
        }
        throw error;
      }
    };
    return deliver(events);
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
  queue.suspend();
  needsConsent = !!uid;
  publish({ enabled: false, ready: false, busy: false, error: "" });
  if (!(await acquireLease())) {
    if (turn === generation)
      publish({
        ready: true,
        error:
          "Analytics abierto en otra pestana o sin soporte de coordinacion.",
      });
    return;
  }
  if (turn !== generation) return;
  // Disable delivery immediately; preserve this account's durable queue until consent is known.
  await queue.open(uid, true);
  if (turn !== generation) return;
  if (!uid) {
    publish({ ready: true });
    return;
  }
  try {
    const pending = pendingRevocations.has(uid)
      ? "1"
      : await AsyncStorage.getItem(optOut(uid));
    if (!current(uid, turn)) return;
    if (pending === "1" || pendingRevocations.has(uid)) {
      queue.revoke();
      await request("/analytics/consent", {
        method: "PATCH",
        body: { enabled: false },
        expectedUid: uid,
      });
      if (!current(uid, turn)) return;
      await AsyncStorage.removeItem(optOut(uid));
      if (!current(uid, turn)) return;
      pendingRevocations.delete(uid);
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
  const uid = owner,
    previous = generation;
  if (!uid || state.busy || !(await acquireLease())) return;
  if (!current(uid, previous) || state.busy) return;
  const turn = ++generation;
  queue.revoke();
  publish({ enabled: false, busy: true, error: "" });
  try {
    if (!enabled) {
      pendingRevocations.add(uid);
      try {
        await AsyncStorage.setItem(optOut(uid), "1");
      } catch {
        /* still attempt remote revocation */
      }
      if (!current(uid, turn)) return;
    }
    await request("/analytics/consent", {
      method: "PATCH",
      body: { enabled },
      expectedUid: uid,
    });
    if (!current(uid, turn)) return;
    await AsyncStorage.removeItem(optOut(uid));
    if (!current(uid, turn)) return;
    pendingRevocations.delete(uid);
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
    const pending = await AsyncStorage.getItem(optOut(uid)).catch(() => null);
    if (!current(uid, turn)) return;
    if (pending === "1" || pendingRevocations.has(uid)) {
      queue.revoke();
      publish({ enabled: false });
      await request("/analytics/consent", {
        method: "PATCH",
        body: { enabled: false },
        expectedUid: uid,
      });
      if (!current(uid, turn)) return;
      await AsyncStorage.removeItem(optOut(uid));
      if (!current(uid, turn)) return;
      pendingRevocations.delete(uid);
      if (turn === generation) publish({ enabled: false, error: "" });
    }
    if (turn === generation && state.enabled) await queue.flush();
  } catch {
    /* bounded queue remains for a later attempt */
  } finally {
    pumping = false;
  }
}
