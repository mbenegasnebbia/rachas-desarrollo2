import { useCallback, useMemo, useState, type ReactNode } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  View,
  type ListRenderItemInfo,
} from "react-native";

import { ControlDesplegable } from "@/components/ui/controlDesplegable";
import { Texto } from "@/components/ui/texto";
import { useEstilos } from "@/theme/estilos";
import { useTema } from "@/theme/useTema";
import type { Posicion, Ranking } from "@/types";

interface Props {
  tabla?: Ranking;
  personaId?: string;
  encabezado: ReactNode;
  pie: ReactNode;
  refrescar: () => void;
  cargando: boolean;
}
const vacio: Posicion[] = [];
const clave = (item: Posicion) => item.personaId;
function Fila({ item, propia }: { item: Posicion; propia: boolean }) {
  const tema = useTema();
  return (
    <View
      style={{
        backgroundColor: tema.colores.fondoRanking,
        paddingHorizontal: tema.medidas.paddingTarjeta,
      }}
    >
      <View
        accessibilityState={{ selected: propia }}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: tema.espacios.sm,
          padding: tema.espacios.sm,
          borderRadius: tema.radios.control,
          backgroundColor: propia
            ? tema.colores.fondoRankingPropio
            : tema.colores.transparente,
        }}
      >
        <Texto
          variante="etiqueta"
          tono="detalleRanking"
          style={{ minWidth: tema.espacios.xxl }}
        >
          {item.posicion}.
        </Texto>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Texto variante="boton" tono="textoRanking">
            @{item.alias}
            {propia ? " · Vos" : ""}
          </Texto>
          <Texto variante="cuerpoSecundario" tono="detalleRanking">
            Racha {item.rachaActual} · Mejor {item.mejorRacha}
          </Texto>
        </View>
        <Texto variante="etiqueta" tono="detalleRanking">
          {item.puntos} puntos
        </Texto>
      </View>
    </View>
  );
}
// One vertical FlatList: the colored card spans header, virtualized cells and footer.
export function RankingDesplegable({
  tabla,
  personaId,
  encabezado,
  pie,
  refrescar,
  cargando,
}: Props) {
  const tema = useTema();
  const estilos = useEstilos();
  const [expandido, setExpandido] = useState(false);
  const [completo, setCompleto] = useState(false);
  const items = tabla?.items ?? vacio;
  const propia = items.find((item) => item.personaId === personaId);
  const visibles = useMemo(
    () => (!expandido ? vacio : completo ? items : items.slice(0, 3)),
    [expandido, completo, items],
  );
  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<Posicion>) => (
      <Fila item={item} propia={item.personaId === personaId} />
    ),
    [personaId],
  );
  return (
    <KeyboardAvoidingView
      style={estilos.pantalla}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <FlatList
        style={estilos.pantalla}
        contentContainerStyle={[estilos.contenido, { gap: 0 }]}
        data={visibles}
        renderItem={renderItem}
        keyExtractor={clave}
        extraData={personaId}
        initialNumToRender={6}
        maxToRenderPerBatch={10}
        windowSize={5}
        keyboardShouldPersistTaps="handled"
        refreshing={cargando}
        onRefresh={refrescar}
        ListHeaderComponent={
          <View style={estilos.seccion}>
            {encabezado}
            <View
              style={{
                backgroundColor: tema.colores.fondoRanking,
                padding: tema.medidas.paddingTarjeta,
                gap: tema.espacios.sm,
                borderTopLeftRadius: tema.radios.tarjeta,
                borderTopRightRadius: tema.radios.tarjeta,
                borderBottomLeftRadius: expandido ? 0 : tema.radios.tarjeta,
                borderBottomRightRadius: expandido ? 0 : tema.radios.tarjeta,
              }}
            >
              <ControlDesplegable
                titulo="Ranking"
                tono="textoRanking"
                expandido={expandido}
                onPress={() => {
                  setExpandido((v) => !v);
                  setCompleto(false);
                }}
              />
              {!expandido &&
                (propia ? (
                  <Texto variante="cuerpoSecundario" tono="detalleRanking">
                    Tu posición: {propia.posicion}. @{propia.alias} ·{" "}
                    {propia.puntos} puntos
                  </Texto>
                ) : (
                  <Texto variante="cuerpoSecundario" tono="detalleRanking">
                    {items.length
                      ? "Consultá las posiciones del desafío."
                      : "Todavía no hay participantes en el ranking."}
                  </Texto>
                ))}
              {expandido && !items.length && (
                <Texto tono="detalleRanking">
                  Todavía no hay participantes en el ranking.
                </Texto>
              )}
            </View>
          </View>
        }
        ListFooterComponent={
          <View
            style={{
              gap: tema.medidas.espacioSeccion,
              paddingTop: expandido ? 0 : tema.medidas.espacioSeccion,
            }}
          >
            {expandido && (
              <View
                style={{
                  backgroundColor: tema.colores.fondoRanking,
                  padding: tema.medidas.paddingTarjeta,
                  gap: tema.espacios.sm,
                  borderBottomLeftRadius: tema.radios.tarjeta,
                  borderBottomRightRadius: tema.radios.tarjeta,
                }}
              >
                {items.length > 3 && (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setCompleto((v) => !v)}
                    style={{
                      minHeight: tema.medidas.toqueMinimo,
                      justifyContent: "center",
                    }}
                  >
                    <Texto variante="boton" tono="detalleRanking">
                      {completo
                        ? "Ver solo los tres primeros"
                        : "Ver ranking completo"}
                    </Texto>
                  </Pressable>
                )}
                {tabla?.ganador && (
                  <Texto variante="etiqueta" tono="detalleRanking">
                    Ganador: @{tabla.ganador.alias}
                  </Texto>
                )}
              </View>
            )}
            {pie}
          </View>
        }
      />
    </KeyboardAvoidingView>
  );
}
