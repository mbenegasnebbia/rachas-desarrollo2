import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
export function mensajeError(e: unknown) {
  return e instanceof Error ? e.message : "No se pudo completar la operación.";
}
// Optional context scopes a snapshot to its account/query. Hide it immediately
// when that context changes, even before the next focus effect starts fetching.
export function useCarga<T>(consulta: () => Promise<T>, contexto?: string) {
  const [instantanea, setInstantanea] = useState<{
    contexto?: string;
    valor: T;
  } | null>(null);
  const [cargando, setCargando] = useState(true);
  const [fallo, setFallo] = useState({ contexto, mensaje: "" });
  const secuencia = useRef(0);
  const cargar = useCallback(async () => {
    const turno = ++secuencia.current;
    setCargando(true);
    setFallo({ contexto, mensaje: "" });
    try {
      const resultado = await consulta();
      if (turno === secuencia.current)
        setInstantanea({ contexto, valor: resultado });
    } catch (e) {
      if (turno === secuencia.current)
        setFallo({ contexto, mensaje: mensajeError(e) });
    } finally {
      if (turno === secuencia.current) setCargando(false);
    }
  }, [consulta, contexto]);
  useFocusEffect(
    useCallback(() => {
      void cargar();
      return () => {
        secuencia.current++;
      };
    }, [cargar]),
  );
  return {
    datos:
      instantanea?.contexto === contexto ? (instantanea?.valor ?? null) : null,
    cargando: fallo.contexto === contexto ? cargando : true,
    error: fallo.contexto === contexto ? fallo.mensaje : "",
    cargar,
  };
}
export function useAccion() {
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  const bloqueo = useRef(false);
  async function ejecutar(accion: () => Promise<void>) {
    if (bloqueo.current) return;
    bloqueo.current = true;
    setOcupado(true);
    setError("");
    try {
      await accion();
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      bloqueo.current = false;
      setOcupado(false);
    }
  }
  return {
    ocupado,
    error,
    ejecutar,
    limpiarError: () => {
      if (!bloqueo.current) setError("");
    },
  };
}
