import { useState } from "react";
import { Modal, Pressable, View } from "react-native";

import { Boton, useEstilos } from "@/components/ui";
import { Texto } from "@/components/ui/texto";
import { useTema } from "@/theme/useTema";
import { fechaVisible, moverDia } from "@/utils/fechas";

interface Props {
  etiqueta: string;
  valor: string;
  cambiar: (v: string) => void;
}

export function FechaSelector({
  etiqueta,
  valor,
  cambiar,
}: Props) {
  const tema = useTema();
  const estilos = useEstilos();

  const [abierto, setAbierto] = useState(false),
    [mes, setMes] = useState(valor.slice(0, 7));
  const primero = mes + "-01";
  const inicio = moverDia(
    primero,
    -((new Date(primero + "T00:00:00Z").getUTCDay() + 6) % 7),
  );
  function moverMes(n: number) {
    const d = new Date(primero + "T00:00:00Z");
    d.setUTCMonth(d.getUTCMonth() + n);
    setMes(d.toISOString().slice(0, 7));
  }
  return (
    <View style={{ gap: tema.espacios.sm }}>
      <Texto style={estilos.etiqueta}>{etiqueta}</Texto>
      <Boton
        titulo={fechaVisible(valor)}
        onPress={() => {
          setMes(valor.slice(0, 7));
          setAbierto(true);
        }}
        secundario
      />
      <Modal
        visible={abierto}
        transparent
        animationType="fade"
        onRequestClose={() => setAbierto(false)}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            padding: tema.espacios.xl,
            backgroundColor: tema.colores.velo,
          }}
        >
          <View
            style={[
              estilos.tarjeta,
              {
                width: "100%",
                maxWidth: tema.medidas.anchoContenido,
                alignSelf: "center",
              },
            ]}
          >
            <View style={[estilos.fila, { justifyContent: "space-between" }]}>
              <Boton
                titulo="‹"
                accessibilityLabel="Mes anterior"
                onPress={() => moverMes(-1)}
              />
              <Texto style={estilos.subtitulo}>{mes}</Texto>
              <Boton
                titulo="›"
                accessibilityLabel="Mes siguiente"
                onPress={() => moverMes(1)}
              />
            </View>
            <View style={{ flexDirection: "row" }}>
              {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
                <Texto
                  key={i}
                  style={{
                    width: "14.28%",
                    textAlign: "center",
                    ...tema.tipografia.etiqueta,
                    color: tema.colores.texto,
                  }}
                >
                  {d}
                </Texto>
              ))}
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {Array.from({ length: 42 }, (_, i) => {
                const dia = moverDia(inicio, i),
                  seleccionado = dia === valor;
                return (
                  <Pressable
                    key={dia}
                    accessibilityRole="button"
                    accessibilityLabel={fechaVisible(dia)}
                    accessibilityState={{ selected: seleccionado }}
                    onPress={() => {
                      cambiar(dia);
                      setAbierto(false);
                    }}
                    style={{
                      width: "14.28%",
                      minHeight: tema.medidas.toqueMinimo,
                      justifyContent: "center",
                      alignItems: "center",
                      borderRadius: tema.radios.control,
                      backgroundColor: seleccionado
                        ? tema.colores.primario
                        : tema.colores.transparente,
                    }}
                  >
                    <Texto
                      style={{
                        ...tema.tipografia.cuerpo,
                        color: seleccionado
                          ? tema.colores.sobrePrimario
                          : dia.startsWith(mes)
                            ? tema.colores.texto
                            : tema.colores.textoSecundario,
                      }}
                    >
                      {Number(dia.slice(-2))}
                    </Texto>
                  </Pressable>
                );
              })}
            </View>
            <Boton
              titulo="Cerrar calendario"
              onPress={() => setAbierto(false)}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}
