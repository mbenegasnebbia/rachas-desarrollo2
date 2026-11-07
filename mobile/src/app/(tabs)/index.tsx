import { router } from "expo-router";
import { useCallback } from "react";
import { ActivityIndicator, FlatList, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { checkin } from "@/api/checkins";
import { resumen } from "@/api/personas";
import { ResumenMetricas } from "@/components/desafios/resumenMetricas";
import { Aviso } from "@/components/ui";
import { Badge } from "@/components/ui/badge";
import { Boton } from "@/components/ui/boton";
import { Encabezado } from "@/components/ui/encabezado";
import { EstadoVacio } from "@/components/ui/estadoVacio";
import { IconoCircular } from "@/components/ui/iconoCircular";
import { Tarjeta } from "@/components/ui/tarjeta";
import { Texto } from "@/components/ui/texto";
import { useCarga, useAccion } from "@/hooks/useCarga";
import { useSesion } from "@/session/sesion";
import { useEstilos } from "@/theme/estilos";
import { useTema } from "@/theme/useTema";
import { hoy, fechaVisible } from "@/utils/fechas";
import { primerNombreVisible } from "@/utils/personas";

export default function Inicio() {
  const tema = useTema();
  const local = useEstilos();

  const { persona, usuarioFirebase } = useSesion();
  const primerNombre = primerNombreVisible(persona?.nombre);
  const carga = useCarga(
    useCallback(
      () => resumen(persona?.zonaHoraria, usuarioFirebase?.uid),
      [persona?.zonaHoraria, usuarioFirebase?.uid],
    ),
    (persona?.id ?? "") + ":" + (usuarioFirebase?.uid ?? ""),
  );
  const accion = useAccion();
  return (
    <SafeAreaView edges={["top", "left", "right"]} style={local.pantalla}>
      <FlatList
        style={local.pantalla}
        contentContainerStyle={[
          local.contenido,
          { gap: tema.medidas.espacioListado },
        ]}
        data={carga.datos ?? []}
        keyExtractor={(item) => item.desafio.id}
        refreshing={carga.cargando}
        onRefresh={carga.cargar}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={5}
        ListHeaderComponent={
          <View style={local.seccion}>
            <View style={[local.fila, { gap: tema.espacios.md }]}>
              <IconoCircular icono="fuego" tono="acento" tamano="grande" />
              <Texto variante="marca" tono="textoSecundario">
                RACHAS / UN DÍA A LA VEZ
              </Texto>
            </View>
            <Encabezado
              principal
              titulo={
                primerNombre
                  ? "Hoy cuenta, " + primerNombre + "."
                  : "Hoy también cuenta."
              }
              descripcion="Un pequeño paso hoy también cuenta. Hacelo tuyo."
            />
            <Tarjeta tono="primario">
              <Texto variante="seccion" tono="sobrePrimario">
                Tu próximo paso empieza acá.
              </Texto>
              <Texto tono="sobrePrimario">
                Elegí un desafío, encontrá tu ritmo y volvé mañana.
              </Texto>
            </Tarjeta>
            <Aviso texto={accion.error} />
            {carga.cargando && (
              <ActivityIndicator
                accessibilityLabel="Cargando desafíos"
                color={tema.colores.texto}
              />
            )}
            {!!carga.error && (
              <Tarjeta>
                <Texto accessibilityRole="alert" tono="error">
                  {carga.error}
                </Texto>
                <Boton
                  titulo="Reintentar"
                  variante="secundario"
                  onPress={carga.cargar}
                />
              </Tarjeta>
            )}
            <View style={local.encabezadoListado}>
              <Encabezado
                variante="seccionDestacada"
                descripcionVariante="cuerpoSecundario"
                titulo="Tus desafíos"
                descripcion="Pequeños pasos. Grandes ganas."
              />
            </View>
          </View>
        }
        ListEmptyComponent={
          !carga.cargando && !carga.error ? (
            <EstadoVacio
              titulo="Todo empieza con un desafío."
              mensaje="Todavía no participás en desafíos activos o programados. Explorá los disponibles o creá uno propio para empezar."
            />
          ) : undefined
        }
        renderItem={({ item: r }) => (
          <Tarjeta>
            <View style={local.fila}>
              <Badge texto={r.desafio.categoria} />
              <Badge
                texto={
                  r.estado === "PROGRAMADO"
                    ? "Programado"
                    : r.estado === "ACTIVO"
                      ? "En marcha"
                      : r.estado
                }
                tono={r.estado === "ACTIVO" ? "exito" : "neutro"}
              />
            </View>
            <Texto variante="desafioListado">{r.desafio.nombre}</Texto>
            <Texto variante="cuerpoSecundario" tono="textoSecundario">
              {fechaVisible(r.desafio.fechaInicio)} —{" "}
              {fechaVisible(r.desafio.fechaFin)}
            </Texto>
            <ResumenMetricas
              racha={r.rachaActual}
              puntos={r.puntos}
              puesto={r.posicion}
            />
            {r.checkinHoy ? (
              <Badge texto="Hoy ya cumpliste" tono="exito" />
            ) : r.estado === "PROGRAMADO" ? (
              <Texto variante="cuerpoSecundario" tono="textoSecundario">
                Todavía no comenzó
              </Texto>
            ) : (
              <Boton
                titulo="Hacer check-in de hoy"
                disabled={
                  accion.ocupado || r.checkinHoy || r.estado !== "ACTIVO"
                }
                onPress={() =>
                  void accion.ejecutar(async () => {
                    await checkin(r.desafio.id, {
                      fecha: hoy(persona?.zonaHoraria),
                      zonaHoraria:
                        persona?.zonaHoraria ??
                        "America/Argentina/Buenos_Aires",
                    });
                    await carga.cargar();
                  })
                }
              />
            )}
            <Boton
              titulo="Ver desafío"
              variante="secundario"
              onPress={() =>
                router.push({
                  pathname: "/desafio/[id]",
                  params: { id: r.desafio.id },
                })
              }
            />
          </Tarjeta>
        )}
        ListFooterComponent={
          <Boton
            titulo="Explorar desafíos"
            variante="secundario"
            onPress={() => router.navigate("/(tabs)/explorar")}
          />
        }
      />
    </SafeAreaView>
  );
}
