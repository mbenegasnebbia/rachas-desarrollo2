import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { View } from "react-native";

import { checkin, deshacer, historial } from "@/api/checkins";
import {
  abandonar,
  cancelar,
  obtenerDesafio,
  participantes,
  ranking,
} from "@/api/desafios";
import { Alientos } from "@/components/desafios/alientos";
import { EtiquetasDesafio } from "@/components/desafios/etiquetasDesafio";
import { Invitacion } from "@/components/desafios/invitacion";
import { RankingDesplegable } from "@/components/desafios/rankingDesplegable";
import { ResumenMetricas } from "@/components/desafios/resumenMetricas";
import { UnirseFormulario } from "@/components/desafios/unirseFormulario";
import {
  Tarjeta,
  Encabezado,
  Badge,
  SeccionExpandible,
  Aviso,
  Boton,
  Campo,
  EstadoCarga,
  Opciones,
  Paginador,
  useEstilos,
} from "@/components/ui";
import { Texto } from "@/components/ui/texto";
import { useCarga, useAccion } from "@/hooks/useCarga";
import { useDesafioRealtime } from "@/hooks/useDesafioRealtime";
import { useSesion } from "@/session/sesion";
import { estadoDe, fechaVisible, hoy, moverDia } from "@/utils/fechas";

export default function Detalle() {
  const estilos = useEstilos();

  const { id: parametro } = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(parametro) ? parametro[0] : parametro;
  const sesion = useSesion(),
    persona = sesion.persona;
  const [pagina, setPagina] = useState(1),
    [dia, setDia] = useState("HOY"),
    [nota, setNota] = useState(""),
    [valor, setValor] = useState(""),
    [confirmacion, setConfirmacion] = useState("");
  const carga = useCarga(
    useCallback(async () => {
      if (!id || !persona)
        throw new Error("Ingresá para consultar este desafío.");
      const [desafio, personas, tabla, historia] = await Promise.all([
        obtenerDesafio(id),
        participantes(id),
        ranking(id),
        historial(id, persona.id, pagina),
      ]);
      return { desafio, personas, tabla, historia };
    }, [id, persona, pagina]),
  );
  const accion = useAccion();
  const avance = useAccion();
  const ocupado = accion.ocupado || avance.ocupado;
  const d = carga.datos?.desafio,
    tabla = carga.datos?.tabla;
  const propio = tabla?.items.find((p) => p.personaId === persona?.id);
  const activo = !!d && estadoDe(d) === "ACTIVO";
  const vigente = !!d && ["ACTIVO", "PROGRAMADO"].includes(estadoDe(d));
  const participa = !!persona && !!d?.participantes.includes(persona.id);
  const abandono = !!persona && !!d?.exParticipantes.includes(persona.id);
  const completo = !!d && d.participantes.length >= d.maxParticipantes;
  const realtime = useDesafioRealtime(
    id,
    persona?.id,
    participa && vigente,
    carga.cargar,
  );
  if (!sesion.cargando && !persona?.perfilCompleto)
    return <Redirect href="/ingreso" />;
  return (
    <RankingDesplegable
      key={id + ":" + (persona?.id ?? "")}
      tabla={tabla}
      personaId={persona?.id}
      refrescar={carga.cargar}
      cargando={carga.cargando}
      encabezado={
        <>
          <EstadoCarga {...carga} reintentar={carga.cargar} />
          <Aviso texto={accion.error} />
          {d && (
            <>
              <View style={estilos.grupo}>
                <Encabezado variante="desafioTitulo" titulo={d.nombre} />
                <View style={estilos.fila}>
                  <Badge texto={d.categoria} />
                  <Badge
                    texto={estadoDe(d)}
                    tono={
                      activo
                        ? "exito"
                        : estadoDe(d) === "PROGRAMADO"
                          ? "advertencia"
                          : estadoDe(d) === "CANCELADO"
                            ? "error"
                            : "neutro"
                    }
                  />
                </View>
                <Texto style={estilos.texto}>
                  {d.descripcion || "Sin descripción."}
                </Texto>
                <Texto variante="cuerpoSecundario" tono="textoSecundario">
                  {fechaVisible(d.fechaInicio)} — {fechaVisible(d.fechaFin)}
                </Texto>
                <Texto variante="cuerpoSecundario" tono="textoSecundario">
                  {d.participantes.length}/{d.maxParticipantes} participantes
                </Texto>
                <EtiquetasDesafio desafio={d} personaId={persona?.id} />
              </View>
              {!participa && vigente && !abandono && !completo && (
                <UnirseFormulario
                  codigoEsperado={d.codigoInvitacion}
                  disabled={ocupado || carga.cargando || !!carga.error}
                  alUnirse={async () => {
                    await carga.cargar();
                  }}
                />
              )}
              {participa && activo && (
                <Tarjeta tono="primario">
                  <Texto variante="tarjetaTitulo" tono="sobrePrimario">
                    Tu check-in
                  </Texto>
                  <Aviso texto={avance.error} />
                  <Opciones
                    valores={["HOY", "AYER"]}
                    valor={dia}
                    cambiar={(nuevoDia) => {
                      setDia(nuevoDia);
                      avance.limpiarError();
                    }}
                  />
                  {dia === "HOY" && propio?.checkinHoy ? (
                    <Texto accessibilityLiveRegion="polite" tono="sobrePrimario">
                      Hoy ya cumpliste.
                    </Texto>
                  ) : (
                    <>
                      <Campo
                        etiqueta="Nota (opcional, hasta 140 caracteres)"
                        value={nota}
                        onChangeText={(texto) => {
                          setNota(texto);
                          avance.limpiarError();
                        }}
                        maxLength={140}
                      />
                      <Campo
                        etiqueta="Valor numérico (opcional)"
                        keyboardType="decimal-pad"
                        value={valor}
                        onChangeText={(texto) => {
                          setValor(texto);
                          avance.limpiarError();
                        }}
                      />
                      <Boton
                        secundario
                        titulo={
                          dia === "HOY" && propio?.checkinHoy
                            ? "Hoy ya cumpliste"
                            : "Guardar check-in"
                        }
                        disabled={
                          ocupado || (dia === "HOY" && propio?.checkinHoy)
                        }
                        onPress={() =>
                          void avance.ejecutar(async () => {
                            const numero = valor.trim()
                              ? Number(valor.replace(",", "."))
                              : undefined;
                            if (
                              numero !== undefined &&
                              !Number.isFinite(numero)
                            )
                              throw new Error(
                                "Ingresá un valor numérico válido.",
                              );
                            await checkin(id, {
                              fecha:
                                dia === "HOY"
                                  ? hoy(persona?.zonaHoraria)
                                  : moverDia(hoy(persona?.zonaHoraria), -1),
                              nota: nota || undefined,
                              valor: numero,
                            });
                            setNota("");
                            setValor("");
                            setPagina(1);
                            await carga.cargar();
                          })
                        }
                      />
                    </>
                  )}
                  {propio?.checkinHoy && (
                    <>
                      <Boton
                        titulo="Deshacer check-in de hoy"
                        secundario
                        disabled={ocupado || !propio?.checkinHoy}
                        onPress={() =>
                          void avance.ejecutar(async () => {
                            await deshacer(id);
                            await carga.cargar();
                          })
                        }
                      />
                    </>
                  )}
                </Tarjeta>
              )}
              {propio && (
                <View style={estilos.grupo}>
                  <Texto variante="seccionTitulo" accessibilityRole="header">
                    Tu progreso
                  </Texto>
                  <ResumenMetricas
                    racha={propio.rachaActual}
                    puntos={propio.puntos}
                    puesto={propio.posicion}
                  />
                </View>
              )}
            </>
          )}
        </>
      }
      pie={
        <>
          {d && (
            <>
              {participa && vigente ? (
                <Alientos activo={activo} realtime={realtime} />
              ) : null}
              <SeccionExpandible
                titulo="Participantes"
                resumen={d.participantes.length + " personas"}
              >
                {carga.datos?.personas.length === 0 && (
                  <Texto style={estilos.texto}>Sin participantes.</Texto>
                )}
                {carga.datos?.personas.map((p) => (
                  <Texto key={p.id} style={[estilos.texto, estilos.filaInfo]}>
                    {p.nombre} · @{p.alias}
                  </Texto>
                ))}
              </SeccionExpandible>
              <Invitacion desafio={d} vigente={vigente} participa={participa} />
              <SeccionExpandible
                titulo="Historial de actividad"
                resumen="Consultá tus registros"
              >
                {carga.datos?.historia.items.length === 0 && (
                  <Texto style={estilos.texto}>
                    Todavía no registraste check-ins.
                  </Texto>
                )}
                {carga.datos?.historia.items.map((c) => (
                  <View key={c.id} style={estilos.filaInfo}>
                    <Texto variante="etiqueta">
                      {fechaVisible(c.fecha)} · {c.puntos ?? 0} puntos
                    </Texto>
                    <Texto style={estilos.texto}>
                      {c.nota || "Sin nota"}
                      {c.valor !== undefined ? " · Valor: " + c.valor : ""}
                    </Texto>
                  </View>
                ))}
                <Paginador
                  pagina={pagina}
                  paginas={carga.datos?.historia.paginas ?? 0}
                  cambiar={setPagina}
                  disabled={carga.cargando}
                />
              </SeccionExpandible>
              {participa && vigente && (
                <View style={estilos.tarjeta}>
                  <Boton
                    titulo={
                      d.creador === persona?.id
                        ? "Cancelar desafío"
                        : "Abandonar desafío"
                    }
                    variante="peligro"
                    disabled={ocupado}
                    onPress={() =>
                      setConfirmacion(
                        d.creador === persona?.id ? "cancelar" : "abandonar",
                      )
                    }
                  />
                  {!!confirmacion && (
                    <>
                      <Texto style={estilos.texto}>
                        {confirmacion === "cancelar"
                          ? "Se cerrará el desafío para todas las personas."
                          : "Conservarás tu historial, pero no podrás volver a unirte."}
                      </Texto>
                      <Boton
                        titulo="Confirmar"
                        variante="peligro"
                        disabled={ocupado}
                        onPress={() =>
                          void accion.ejecutar(async () => {
                            if (confirmacion === "cancelar") await cancelar(id);
                            else await abandonar(id);
                            setConfirmacion("");
                            router.replace("/(tabs)");
                          })
                        }
                      />
                      <Boton
                        titulo="Volver"
                        secundario
                        disabled={ocupado}
                        onPress={() => setConfirmacion("")}
                      />
                    </>
                  )}
                </View>
              )}
            </>
          )}
        </>
      }
    />
  );
}
