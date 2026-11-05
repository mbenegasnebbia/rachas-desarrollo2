import { useCallback, useState } from "react";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { Share, Text, View } from "react-native";
import {
  abandonar,
  cancelar,
  obtenerDesafio,
  participantes,
  ranking,
} from "@/api/desafios";
import { checkin, deshacer, historial } from "@/api/checkins";
import { useSesion } from "@/session/Sesion";
import { useCarga, useAccion } from "@/hooks/useCarga";
import {
  Aviso,
  Boton,
  Campo,
  EstadoCarga,
  Opciones,
  Paginador,
  Pantalla,
  estilos,
} from "@/components/UI";
import { estadoDe, fechaVisible, hoy, moverDia } from "@/utils/fechas";
export default function Detalle() {
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
  if (!sesion.cargando && !persona) return <Redirect href="/ingreso" />;
  const d = carga.datos?.desafio,
    tabla = carga.datos?.tabla;
  const propio = tabla?.items.find((p) => p.personaId === persona?.id);
  const activo = !!d && estadoDe(d) === "ACTIVO";
  const vigente = !!d && ["ACTIVO", "PROGRAMADO"].includes(estadoDe(d));
  const participa = !!persona && !!d?.participantes.includes(persona.id);
  return (
    <Pantalla refrescar={carga.cargar} cargando={carga.cargando}>
      <EstadoCarga {...carga} reintentar={carga.cargar} />
      <Aviso texto={accion.error} />
      {d && (
        <>
          <Text style={estilos.titulo}>{d.nombre}</Text>
          <Text style={estilos.texto}>
            {d.categoria} · {estadoDe(d)}
          </Text>
          <Text style={estilos.texto}>
            {d.descripcion || "Sin descripción."}
          </Text>
          <Text style={estilos.texto}>
            {fechaVisible(d.fechaInicio)} — {fechaVisible(d.fechaFin)}
          </Text>
          <Text style={estilos.texto}>
            {d.participantes.length}/{d.maxParticipantes} participantes
          </Text>
          <View style={estilos.tarjeta}>
            <Text selectable style={estilos.subtitulo}>
              Código: {d.codigoInvitacion}
            </Text>
            <Boton
              titulo="Compartir invitación"
              disabled={accion.ocupado || !vigente}
              onPress={() =>
                void accion.ejecutar(async () => {
                  await Share.share({
                    message: `Sumate a "${d.nombre}" en Rachas con el código ${d.codigoInvitacion}.`,
                  });
                })
              }
            />
          </View>
          <Text style={estilos.subtitulo}>Participantes</Text>
          {carga.datos?.personas.length === 0 && (
            <Text style={estilos.texto}>Sin participantes.</Text>
          )}
          {carga.datos?.personas.map((p) => (
            <Text key={p.id} style={estilos.texto}>
              {p.nombre} · @{p.alias}
            </Text>
          ))}
          <Text style={estilos.subtitulo}>Ranking</Text>
          {tabla?.items.length === 0 && (
            <Text style={estilos.texto}>
              Todavía no hay participantes en el ranking.
            </Text>
          )}
          {tabla?.items.map((p) => (
            <View key={p.personaId} style={estilos.tarjeta}>
              <Text style={estilos.subtitulo}>
                {p.posicion}. @{p.alias} · {p.puntos} puntos
              </Text>
              <Text style={estilos.texto}>
                Racha actual {p.rachaActual} · Mejor racha {p.mejorRacha}
              </Text>
            </View>
          ))}
          {tabla?.ganador && (
            <Text style={estilos.subtitulo}>
              Ganador: @{tabla.ganador.alias}
            </Text>
          )}
          {participa && activo && (
            <View style={estilos.tarjeta}>
              <Text style={estilos.subtitulo}>Registrar tu avance</Text>
              <Opciones
                valores={["HOY", "AYER"]}
                valor={dia}
                cambiar={setDia}
              />
              <Campo
                etiqueta="Nota (opcional, hasta 140 caracteres)"
                value={nota}
                onChangeText={setNota}
                maxLength={140}
              />
              <Campo
                etiqueta="Valor numérico (opcional)"
                keyboardType="decimal-pad"
                value={valor}
                onChangeText={setValor}
              />
              <Boton
                titulo={
                  dia === "HOY" && propio?.checkinHoy
                    ? "Hoy ya cumpliste"
                    : "Guardar check-in"
                }
                disabled={
                  accion.ocupado || (dia === "HOY" && propio?.checkinHoy)
                }
                onPress={() =>
                  void accion.ejecutar(async () => {
                    const numero = valor.trim()
                      ? Number(valor.replace(",", "."))
                      : undefined;
                    if (numero !== undefined && !Number.isFinite(numero))
                      throw new Error("Ingresá un valor numérico válido.");
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
              <Boton
                titulo="Deshacer check-in de hoy"
                secundario
                disabled={accion.ocupado || !propio?.checkinHoy}
                onPress={() =>
                  void accion.ejecutar(async () => {
                    await deshacer(id);
                    await carga.cargar();
                  })
                }
              />
            </View>
          )}
          <Text style={estilos.subtitulo}>Tus días cumplidos</Text>
          {carga.datos?.historia.items.length === 0 && (
            <Text style={estilos.texto}>Todavía no registraste check-ins.</Text>
          )}
          {carga.datos?.historia.items.map((c) => (
            <View key={c.id} style={estilos.tarjeta}>
              <Text style={estilos.subtitulo}>
                {fechaVisible(c.fecha)} · {c.puntos ?? 0} puntos
              </Text>
              <Text style={estilos.texto}>
                {c.nota || "Sin nota"}
                {c.valor !== undefined ? " · Valor: " + c.valor : ""}
              </Text>
            </View>
          ))}
          <Paginador
            pagina={pagina}
            paginas={carga.datos?.historia.paginas ?? 0}
            cambiar={setPagina}
            disabled={carga.cargando}
          />
          {participa && vigente && (
            <View style={estilos.tarjeta}>
              <Boton
                titulo={
                  d.creador === persona?.id
                    ? "Cancelar desafío"
                    : "Abandonar desafío"
                }
                secundario
                disabled={accion.ocupado}
                onPress={() =>
                  setConfirmacion(
                    d.creador === persona?.id ? "cancelar" : "abandonar",
                  )
                }
              />
              {!!confirmacion && (
                <>
                  <Text style={estilos.texto}>
                    {confirmacion === "cancelar"
                      ? "Se cerrará el desafío para todas las personas."
                      : "Conservarás tu historial, pero no podrás volver a unirte."}
                  </Text>
                  <Boton
                    titulo="Confirmar"
                    disabled={accion.ocupado}
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
                    disabled={accion.ocupado}
                    onPress={() => setConfirmacion("")}
                  />
                </>
              )}
            </View>
          )}
        </>
      )}
    </Pantalla>
  );
}
