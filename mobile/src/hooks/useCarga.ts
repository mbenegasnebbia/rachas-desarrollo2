import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
export function mensajeError(e: unknown) {
  return e instanceof Error ? e.message : "No se pudo completar la operación.";
}
export function useCarga<T>(consulta: () => Promise<T>) {
  const [datos, setDatos] = useState<T | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const secuencia = useRef(0);
  const cargar = useCallback(async () => {
    const turno = ++secuencia.current;
    setCargando(true);
    setError("");
    try {
      const resultado = await consulta();
      if (turno === secuencia.current) setDatos(resultado);
    } catch (e) {
      if (turno === secuencia.current) setError(mensajeError(e));
    } finally {
      if (turno === secuencia.current) setCargando(false);
    }
  }, [consulta]);
  useFocusEffect(
    useCallback(() => {
      void cargar();
      return () => {
        secuencia.current++;
      };
    }, [cargar]),
  );
  return { datos, cargando, error, cargar };
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
  return { ocupado, error, ejecutar };
}
