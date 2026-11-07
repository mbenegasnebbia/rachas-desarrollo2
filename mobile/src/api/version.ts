import Constants from "expo-constants";
import { Platform } from "react-native";

export const APP_VERSION = Constants.expoConfig?.version ?? "1.1.0";
export interface VersionPolicy {
  minimumVersion: string;
  recommendedVersion: string;
  updateUrl: string | null;
  instructions: string;
}
export function appHeaders() {
  return { "x-app-version": APP_VERSION, "x-platform": Platform.OS };
}
export function compareVersions(a: string, b: string): number {
  const aa = a.split("."),
    bb = b.split(".");
  for (let i = 0; i < 3; i++) {
    if (aa[i].length !== bb[i].length)
      return aa[i].length > bb[i].length ? 1 : -1;
    if (aa[i] !== bb[i]) return aa[i] > bb[i] ? 1 : -1;
  }
  return 0;
}
export function isPolicy(value: unknown): value is VersionPolicy {
  if (!value || typeof value !== "object") return false;
  const p = value as Record<string, unknown>;
  const valid = (s: unknown) =>
    typeof s === "string" &&
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(s);
  return (
    valid(p.minimumVersion) &&
    valid(p.recommendedVersion) &&
    compareVersions(
      p.minimumVersion as string,
      p.recommendedVersion as string,
    ) <= 0 &&
    (p.updateUrl === null ||
      (typeof p.updateUrl === "string" && /^https?:\/\//.test(p.updateUrl))) &&
    typeof p.instructions === "string"
  );
}
const listeners = new Set<(policy: VersionPolicy) => void>();
export function onUpgrade(listener: (policy: VersionPolicy) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function reportUpgrade(value: unknown) {
  if (isPolicy(value)) listeners.forEach((listener) => listener(value));
}
// The screen model stays stable; only the wire contract changes.
export function toV2(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(toV2);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, v]) => [
      key === "fechaFin" ? "finalizaEn" : key,
      toV2(v),
    ]),
  );
}
export function fromV2(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(fromV2);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, v]) => [
      key === "finalizaEn" ? "fechaFin" : key,
      key === "puntos" && v && typeof v === "object" && "total" in v
        ? v.total
        : fromV2(v),
    ]),
  );
}
