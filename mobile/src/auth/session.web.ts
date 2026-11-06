import {
  onAuthStateChanged,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { obtenerAuthFirebase } from "./firebase.web";
import { resultadoErrorGoogle } from "./google.web";

export interface UsuarioFirebase {
  uid: string;
}

export function observarSesion(
  cambiar: (user: UsuarioFirebase | null) => void,
  error: (e: unknown) => void,
): () => void {
  return onAuthStateChanged(
    obtenerAuthFirebase(),
    (user) => {
      cambiar(user ? { uid: user.uid } : null);
    },
    error,
  );
}

export async function ingresarConGoogle(): Promise<void> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  await signInWithPopup(obtenerAuthFirebase(), provider);
}

export async function obtenerToken(
  force = false,
  expectedUid?: string,
): Promise<string | null> {
  const auth = obtenerAuthFirebase(),
    user = auth.currentUser;
  if (!user || (expectedUid && user.uid !== expectedUid)) return null;
  const token = await user.getIdToken(force);
  if (expectedUid && auth.currentUser !== user) return null;
  return token;
}

export async function cerrarSesionFirebase(): Promise<void> {
  await signOut(obtenerAuthFirebase());
}

export function mensajeErrorAuth(error: unknown): string {
  return resultadoErrorGoogle(error).mensaje;
}
