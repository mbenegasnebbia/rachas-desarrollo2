import { useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { Boton, estilos } from "./UI";
import { fechaVisible, moverDia } from "@/utils/fechas";
export function FechaSelector({
  etiqueta,
  valor,
  cambiar,
}: {
  etiqueta: string;
  valor: string;
  cambiar: (v: string) => void;
}) {
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
    <View style={{ gap: 6 }}>
      <Text style={estilos.etiqueta}>{etiqueta}</Text>
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
            padding: 20,
            backgroundColor: "#0008",
          }}
        >
          <View style={estilos.tarjeta}>
            <View style={[estilos.fila, { justifyContent: "space-between" }]}>
              <Boton titulo="‹" onPress={() => moverMes(-1)} />
              <Text style={estilos.subtitulo}>{mes}</Text>
              <Boton titulo="›" onPress={() => moverMes(1)} />
            </View>
            <View style={{ flexDirection: "row" }}>
              {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
                <Text
                  key={i}
                  style={{
                    width: "14.28%",
                    textAlign: "center",
                    fontWeight: "600",
                  }}
                >
                  {d}
                </Text>
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
                      minHeight: 44,
                      justifyContent: "center",
                      alignItems: "center",
                      borderRadius: 8,
                      backgroundColor: seleccionado ? "#256448" : "transparent",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 16,
                        color: seleccionado
                          ? "#FFF"
                          : dia.startsWith(mes)
                            ? "#222C27"
                            : "#879183",
                      }}
                    >
                      {Number(dia.slice(-2))}
                    </Text>
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
