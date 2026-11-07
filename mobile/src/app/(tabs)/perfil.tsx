import { router } from "expo-router";
import { useCallback, useState } from "react";
import { Switch, View } from "react-native";

import { useAnalytics } from "@/analytics/analyticsProvider";
import { obtenerPersona, actualizarPersona, resultados } from "@/api/personas";
import { TarjetaDesafio } from "@/components/desafios/tarjetaDesafio";
import {
  Encabezado,
  IconoCircular,
  Seccion,
  Aviso,
  Boton,
  Campo,
  EstadoCarga,
  Pantalla,
  useEstilos,
} from "@/components/ui";
import { Estadistica } from "@/components/ui/estadistica";
import { Texto } from "@/components/ui/texto";
import { useCarga, useAccion } from "@/hooks/useCarga";
import { useSesion } from "@/session/sesion";
import { validarPerfil } from "@/utils/validaciones";

export default function Perfil() {
  const estilos = useEstilos();

  const sesion = useSesion();
  const analytics = useAnalytics();
  const id = sesion.persona?.id ?? "";
  const carga = useCarga(
    useCallback(
      async () => ({
        persona: await obtenerPersona(id),
        resultados: await resultados(),
      }),
      [id],
    ),
  );
  const accion = useAccion();
  const [nombre, setNombre] = useState(sesion.persona?.nombre ?? ""),
    [zona, setZona] = useState(
      sesion.persona?.zonaHoraria ?? "America/Argentina/Buenos_Aires",
    ),
    [aviso, setAviso] = useState("");
  return (
    <Pantalla refrescar={carga.cargar} cargando={carga.cargando}>
      <IconoCircular icono="perfil" tono="secundario" tamano="grande" />
      <Encabezado
        principal
        titulo="Tu perfil"
        descripcion="Tu ritmo, tus datos y lo que ya lograste."
      />
      <Texto style={estilos.texto}>@{sesion.persona?.alias}</Texto>
      <EstadoCarga {...carga} reintentar={carga.cargar} />
      <Seccion titulo="Tus datos">
        <Campo etiqueta="Nombre" value={nombre} onChangeText={setNombre} />
        <Campo
          etiqueta="Zona horaria IANA"
          autoCapitalize="none"
          value={zona}
          onChangeText={setZona}
        />
        <Aviso texto={accion.error} />
        <Texto style={estilos.texto}>{aviso}</Texto>
        <Boton
          titulo="Guardar cambios"
          disabled={accion.ocupado}
          onPress={() =>
            void accion.ejecutar(async () => {
              setAviso("");
              validarPerfil(nombre, zona);
              await sesion.guardar(
                await actualizarPersona(id, {
                  nombre: nombre.trim(),
                  zonaHoraria: zona,
                }),
              );
              setAviso("Perfil actualizado.");
            })
          }
        />
      </Seccion>
      <Seccion titulo="Compartir datos de uso">
        <Texto style={estilos.texto}>
          Eventos de uso sin nombres, emails ni notas. Podés desactivarlo cuando
          quieras.
        </Texto>
        <Switch
          accessibilityLabel="Compartir datos de uso"
          value={analytics.enabled}
          disabled={!analytics.ready || analytics.busy}
          onValueChange={(value) => {
            void analytics.setConsent(value);
          }}
        />
        <Aviso texto={analytics.error} />
      </Seccion>
      <Texto accessibilityRole="header" style={estilos.subtitulo}>
        Desafíos finalizados
      </Texto>
      {carga.datos?.resultados.length === 0 && (
        <Texto style={estilos.texto}>Todavía no terminaste ningún desafío.</Texto>
      )}
      {carga.datos?.resultados.map((r) => (
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
          <View style={estilos.estadisticas}>
            <Estadistica
              valor={r.resultado?.posicion ?? "—"}
              etiqueta="puesto"
              icono="trofeo"
            />
            <Estadistica
              valor={r.resultado?.puntos ?? "—"}
              etiqueta="puntos"
              icono="puntos"
            />
            <Estadistica
              valor={r.resultado?.mejorRacha ?? "—"}
              etiqueta="mejor racha"
              icono="fuego"
            />
          </View>
          <Texto style={estilos.texto}>
            Ganador: @{r.ganador?.alias ?? "sin participantes"}
          </Texto>
        </TarjetaDesafio>
      ))}
      <Boton
        titulo="Cerrar sesión"
        variante="peligro"
        disabled={accion.ocupado}
        onPress={() =>
          void accion.ejecutar(async () => {
            await sesion.guardar(null);
            router.replace("/ingreso");
          })
        }
      />
    </Pantalla>
  );
}
