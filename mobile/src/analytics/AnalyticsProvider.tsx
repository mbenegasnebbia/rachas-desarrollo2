import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { AppState } from "react-native";
import { observarSesion } from "@/auth/session";
import {
  analyticsState,
  connectAnalytics,
  flushAnalytics,
  setAnalyticsConsent,
  subscribeAnalytics,
  suspendAnalytics,
} from "./runtime";
const Context = createContext<ReturnType<typeof analyticsState> | null>(null);
export function AnalyticsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(analyticsState);
  useEffect(() => {
    const stopState = subscribeAnalytics(setState);
    let stopAuth: (() => void) | undefined;
    try {
      stopAuth = observarSesion(
        (user) => {
          void connectAnalytics(user?.uid ?? null);
        },
        () => {
          void connectAnalytics(null);
        },
      );
    } catch {
      void connectAnalytics(null);
    }
    const flush = () => {
      void flushAnalytics();
    };
    const timer = setInterval(flush, 30000);
    const appState = AppState.addEventListener("change", (value) => {
      if (value === "active") flush();
    });
    if (typeof window !== "undefined") window.addEventListener("online", flush);
    return () => {
      stopState();
      stopAuth?.();
      clearInterval(timer);
      appState.remove();
      if (typeof window !== "undefined")
        window.removeEventListener("online", flush);
      suspendAnalytics();
    };
  }, []);
  return <Context.Provider value={state}>{children}</Context.Provider>;
}
export function useAnalytics() {
  const state = useContext(Context);
  if (!state) throw new Error("Falta AnalyticsProvider");
  return { ...state, setConsent: setAnalyticsConsent };
}
