import { useCallback } from "react";
import { router } from "expo-router";
import { Text } from "react-native";
import { resumen } from "@/api/personas";
import { checkin } from "@/api/checkins";
import { useSesion } from "@/session/Sesion";
import { useCarga, useAccion } from "@/hooks/useCarga";
import {
  Aviso,
  Boton,
  EstadoCarga,
  Pantalla,
  TarjetaDesafio,
  estilos,
} from "@/components/UI";
import { hoy } from "@/utils/fechas";
export default function Inicio() {
  const { persona } = useSesion();
  const carga = useCarga(
    useCallback(() => resumen(persona?.zonaHoraria), [persona?.zonaHoraria]),
  );
  const accion = useAccion();
  return (
    <Pantalla refrescar={carga.cargar} cargando={carga.cargando}>
      <Text style={estilos.titulo}>Hola, {persona?.nombre}.</Text>
      <Text style={estilos.texto}>Un pequeño paso hoy también cuenta.</Text>
      <Aviso texto={accion.error} />
      <EstadoCarga
        {...carga}
        vacio={carga.datos?.length === 0}
        mensajeVacio="Todavía no participás en desafíos activos o programados. Explorá los disponibles o creá uno propio para empezar."
        reintentar={carga.cargar}
      />
      {carga.datos?.map((r) => (
        <TarjetaDesafio
          key={r.desafio.id}
          desafio={r.desafio}
          abrir={() =>
            router.push({
              pathname: "/desafio/[id]",
              params: { id: r.desafio.id },
            })
          }
        >
          <Text style={estilos.texto}>
            Racha: {r.rachaActual} días · Puesto {r.posicion} · {r.puntos}{" "}
            puntos
          </Text>
          <Boton
            titulo={
              r.checkinHoy
                ? "Hoy ya cumpliste"
                : r.estado === "PROGRAMADO"
                  ? "Todavía no comenzó"
                  : "Hacer check-in de hoy"
            }
            disabled={accion.ocupado || r.checkinHoy || r.estado !== "ACTIVO"}
            onPress={() =>
              void accion.ejecutar(async () => {
                await checkin(r.desafio.id, {
                  fecha: hoy(persona?.zonaHoraria),
                  zonaHoraria:
                    persona?.zonaHoraria ?? "America/Argentina/Buenos_Aires",
                });
                await carga.cargar();
              })
            }
          />
        </TarjetaDesafio>
      ))}
      <Boton
        titulo="Explorar desafíos"
        onPress={() => router.navigate("/(tabs)/explorar")}
      />
    </Pantalla>
  );
}
