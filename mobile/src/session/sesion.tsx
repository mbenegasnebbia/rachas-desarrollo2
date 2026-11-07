import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  observarSesion,
  ingresarConGoogle,
  cerrarSesionFirebase,
  mensajeErrorAuth,
  type UsuarioFirebase,
} from "@/auth/session";
import { personaAutenticada } from "@/api/personas";
import type { Persona } from "@/types";

interface Sesion {
  persona: Persona | null;
  usuarioFirebase: UsuarioFirebase | null;
  cargando: boolean;
  error: string;
  guardar: (p: Persona | null) => Promise<void>;
  ingresar: () => Promise<void>;
  reintentar: () => void;
}
const Contexto = createContext<Sesion | null>(null);
export function SesionProvider({ children }: { children: ReactNode }) {
  const [persona, setPersona] = useState<Persona | null>(null);
  const [usuarioFirebase, setUsuarioFirebase] =
    useState<UsuarioFirebase | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [intento, setIntento] = useState(0);
  const secuencia = useRef(0);
  const personaActual = useRef<Persona | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let vigente = true;
    async function cargar(user: UsuarioFirebase | null) {
      if (!vigente) return;
      const turno = ++secuencia.current;
      setUsuarioFirebase(user);
      personaActual.current = null;
      setPersona(null);
      setError("");
      setCargando(!!user);
      if (!user) return;
      try {
        const perfil = await personaAutenticada();
        if (vigente && turno === secuencia.current) {
          personaActual.current = perfil;
          setPersona(perfil);
        }
      } catch (e) {
        if (vigente && turno === secuencia.current)
          setError(
            e instanceof Error ? e.message : "No se pudo recuperar tu perfil.",
          );
      } finally {
        if (vigente && turno === secuencia.current) setCargando(false);
      }
    }
    void Promise.resolve().then(() => {
      if (!vigente) return;
      try {
        unsubscribe = observarSesion(
          (user) => {
            void cargar(user);
          },
          (e) => {
            if (!vigente) return;
            secuencia.current++;
            setUsuarioFirebase(null);
            personaActual.current = null;
            setPersona(null);
            setError(mensajeErrorAuth(e));
            setCargando(false);
          },
        );
      } catch (e) {
        setError(mensajeErrorAuth(e));
        setCargando(false);
      }
    });
    return () => {
      vigente = false;
      unsubscribe?.();
    };
  }, [intento]);

  async function guardar(p: Persona | null) {
    if (!p) {
      await cerrarSesionFirebase();
      secuencia.current++;
      personaActual.current = null;
      setPersona(null);
      setUsuarioFirebase(null);
      setError("");
      setCargando(false);
    } else {
      if (personaActual.current?.id !== p.id)
        throw new Error(
          "No se puede cambiar de persona sin cambiar de cuenta Google.",
        );
      personaActual.current = p;
      setPersona(p);
    }
  }
  return (
    <Contexto.Provider
      value={{
        persona,
        usuarioFirebase,
        cargando,
        error,
        guardar,
        ingresar: ingresarConGoogle,
        reintentar: () => {
          setCargando(true);
          setError("");
          setIntento((i) => i + 1);
        },
      }}
    >
      {children}
    </Contexto.Provider>
  );
}
export function useSesion() {
  const valor = useContext(Contexto);
  if (!valor) throw new Error("Falta SesionProvider");
  return valor;
}
