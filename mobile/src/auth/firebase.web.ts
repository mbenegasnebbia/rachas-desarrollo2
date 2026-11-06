import { getApps, initializeApp } from "firebase/app";
import {
  browserPopupRedirectResolver,
  getAuth,
  initializeAuth,
  browserLocalPersistence,
  type Auth,
} from "firebase/auth";

export class ConfiguracionFirebaseError extends Error {}

const nombreApp = "rachas-web";

// Firebase administra la persistencia y renovación de la sesión Web.
export function obtenerAuthFirebase(): Auth {
  if (typeof window === "undefined")
    throw new ConfiguracionFirebaseError("La prueba de Google está disponible en el navegador.");

  const config = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  };
  if (Object.values(config).some((valor) => !valor?.trim()))
    throw new ConfiguracionFirebaseError(
      "Falta configuración de Firebase. Completá EXPO_PUBLIC_FIREBASE_API_KEY, AUTH_DOMAIN, PROJECT_ID y APP_ID según mobile/.env.example y reiniciá Expo.",
    );

  const existente = getApps().find((app) => app.name === nombreApp);
  if (existente) return getAuth(existente);

  const app = initializeApp(config, nombreApp);
  return initializeAuth(app, {
    persistence: browserLocalPersistence,
    popupRedirectResolver: browserPopupRedirectResolver,
  });
}

// Compatibilidad con el componente de diagnóstico, ya fuera de la navegación.
export const obtenerAuthPrueba = obtenerAuthFirebase;
