import { FirebaseError } from "firebase/app";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { ConfiguracionFirebaseError, obtenerAuthPrueba } from "./firebase.web";

export interface UsuarioGooglePrueba {
  uid: string;
  nombre: string | null;
  email: string | null;
}

export async function ingresarGooglePrueba(): Promise<UsuarioGooglePrueba> {
  const auth = obtenerAuthPrueba();
  const proveedor = new GoogleAuthProvider();
  proveedor.setCustomParameters({ prompt: "select_account" });
  const { user } = await signInWithPopup(auth, proveedor);
  // No se expone UserCredential ni se solicitan, guardan o imprimen tokens.
  return { uid: user.uid, nombre: user.displayName, email: user.email };
}

export async function cerrarGooglePrueba(): Promise<void> {
  await signOut(obtenerAuthPrueba());
}

export function resultadoErrorGoogle(error: unknown): {
  cancelado: boolean;
  mensaje: string;
} {
  const codigo =
    typeof error === "object" && error !== null && "code" in error
      ? error.code
      : undefined;
  switch (codigo) {
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return { cancelado: true, mensaje: "Ingreso con Google cancelado. Podés volver a intentarlo." };
    case "auth/popup-blocked":
      return { cancelado: false, mensaje: "El navegador bloqueó la ventana de Google. Permití las ventanas emergentes y volvé a intentar." };
    case "auth/unauthorized-domain":
      return { cancelado: false, mensaje: "Este dominio no está autorizado en Firebase Authentication." };
    case "auth/operation-not-allowed":
      return { cancelado: false, mensaje: "El proveedor Google no está habilitado en Firebase Authentication." };
    case "auth/network-request-failed":
      return { cancelado: false, mensaje: "No se pudo conectar con Google o Firebase. Revisá la conexión y reintentá." };
    case "auth/invalid-api-key":
    case "auth/invalid-app-credential":
    case "auth/configuration-not-found":
      return { cancelado: false, mensaje: "Revisá la configuración de Rachas Web y Authentication en Firebase." };
    default:
      return {
        cancelado: false,
        mensaje: error instanceof ConfiguracionFirebaseError
          ? error.message
          : "No se pudo completar la prueba con Google. Volvé a intentar.",
      };
  }
}

function mensajeDiagnosticoSeguro(mensaje: string): string {
  // No serializar error, customData, credenciales ni stack.
  return mensaje
    .replace(/-----BEGIN[\s\S]*?-----END[^-]*-----/g, "[credencial omitida]")
    .replace(/https?:\/\/[^\s"'<>]+/gi, "[URL omitida]")
    .replace(/\bBearer\s+\S+/gi, "Bearer [omitido]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[email omitido]")
    .replace(/(["']?(?:[\w.-]*(?:token|credential|secret|password|api[_-]?key|authorization|private[_-]?key)[\w.-]*)["']?\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;})]+)/gi, "$1[omitido]")
    .replace(/\b[A-Za-z0-9_+/=-]{24,}(?:\.[A-Za-z0-9_+/=-]+)*\b/g, "[valor omitido]")
    .replace(/[\r\n\t]+/g, " ")
    .slice(0, 600);
}

export function diagnosticoErrorGoogle(error: unknown): string {
  if (!__DEV__) return "";

  const firebase = error instanceof FirebaseError;
  const codigoOriginal =
    typeof error === "object" && error !== null && "code" in error
      ? error.code
      : undefined;
  const codigo =
    typeof codigoOriginal === "string" &&
    /^[a-z][a-z0-9-]*\/[a-z0-9-]+$/.test(codigoOriginal)
      ? codigoOriginal
      : undefined;
  const nombre = error instanceof Error ? error.name : "";
  const tipo = firebase
    ? "FirebaseError"
    : /^(Error|TypeError|RangeError|SyntaxError|ReferenceError|DOMException|ConfiguracionFirebaseError)$/.test(nombre)
      ? nombre
      : error instanceof Error ? "Error personalizado" : error === null ? "null" : typeof error;
  const mensaje =
    typeof error === "string" ? error
      : typeof error === "object" && error !== null &&
          "message" in error && typeof error.message === "string"
        ? error.message
        : "La excepción no contiene un mensaje de texto.";
  return [
    `Tipo: ${tipo}`,
    `Código: ${codigo ?? "no disponible"}`,
    `Descripción: ${mensajeDiagnosticoSeguro(mensaje)}`,
  ].join("\n");
}
