import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { identificar } from "@/api/client";
import type { Persona } from "@/types";
const KEY = "rachas.persona.v1";
interface Sesion {
  persona: Persona | null;
  cargando: boolean;
  error: string;
  guardar: (p: Persona | null) => Promise<void>;
  reintentar: () => void;
}
const Contexto = createContext<Sesion | null>(null);
export function SesionProvider({ children }: { children: ReactNode }) {
  const [persona, setPersona] = useState<Persona | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [intento, setIntento] = useState(0);
  useEffect(() => {
    let vigente = true;
    AsyncStorage.getItem(KEY)
      .then(async (raw) => {
        if (!vigente) return;
        if (raw) {
          let p: unknown;
          try {
            p = JSON.parse(raw);
          } catch {
            await AsyncStorage.removeItem(KEY);
            return;
          }
          if (
            typeof p !== "object" ||
            p === null ||
            !("id" in p) ||
            typeof p.id !== "string" ||
            !/^[a-f0-9]{24}$/i.test(p.id)
          ) {
            await AsyncStorage.removeItem(KEY);
            return;
          }
          identificar(p.id);
          setPersona(p as Persona);
        }
      })
      .catch(() => {
        if (vigente)
          setError("No se pudo recuperar la sesión del dispositivo.");
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });
    return () => {
      vigente = false;
    };
  }, [intento]);
  async function guardar(p: Persona | null) {
    if (p) await AsyncStorage.setItem(KEY, JSON.stringify(p));
    else await AsyncStorage.removeItem(KEY);
    identificar(p?.id);
    setPersona(p);
  }
  return (
    <Contexto.Provider
      value={{
        persona,
        cargando,
        error,
        guardar,
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
