import { router } from "expo-router";
import { useCallback, useState } from "react";
import { View } from "react-native";

import { listarCreados, listarSolicitudesRecibidas } from "@/api/solicitudes";
import {
  Badge,
  Boton,
  Encabezado,
  EstadoCarga,
  Paginador,
  Tarjeta,
} from "@/components/ui";
import { Texto } from "@/components/ui/texto";
import { useCarga } from "@/hooks/useCarga";
import { useSesion } from "@/session/sesion";
import { useEstilos } from "@/theme/estilos";
import type { Desafio } from "@/types";
import { estadoDe } from "@/utils/fechas";

import { SolicitudesRecibidas } from "./solicitudesRecibidas";

export function MisCreados() {
  const { persona, usuarioFirebase } = useSesion();
  const personaId = persona?.id;
  const uid = usuarioFirebase?.uid;
  const estilos = useEstilos();
  const [pagina, setPagina] = useState(1);
  const [seleccionado, setSeleccionado] = useState<Desafio | null>(null);
  const carga = useCarga(
    useCallback(async () => {
      const respuesta = await listarCreados(pagina, uid);
      const items = await Promise.all(
        respuesta.items
          .filter((d) => d.creador === personaId)
          .map(async (desafio) => {
            try {
              const solicitudes = await listarSolicitudesRecibidas(
                desafio.id,
                1,
                1,
                uid,
              );
              return { desafio, pendientes: solicitudes.total };
            } catch {
              return { desafio, pendientes: null };
            }
          }),
      );
      return { ...respuesta, items };
    }, [pagina, uid, personaId]),
    (personaId ?? "") + ":" + (uid ?? "") + ":" + pagina,
  );

  if (seleccionado && seleccionado.creador === personaId)
    return (
      <SolicitudesRecibidas
        key={seleccionado.id + ":" + personaId}
        desafio={seleccionado}
        volver={() => setSeleccionado(null)}
        alResolver={carga.cargar}
      />
    );

  return (
    <View style={estilos.seccion}>
      <Encabezado
        titulo="Mis creados"
        descripcion="Tus desafíos y sus solicitudes de acceso."
        variante="seccionTitulo"
        descripcionVariante="cuerpoSecundario"
      />
      <EstadoCarga
        {...carga}
        vacio={carga.datos?.items.length === 0}
        mensajeVacio="Todavía no creaste desafíos. Armá el primero desde Crear."
        reintentar={carga.cargar}
      />
      {!carga.error &&
        carga.datos?.items.map(({ desafio, pendientes }) => (
          <Tarjeta key={desafio.id}>
            <Texto variante="tarjetaTitulo">{desafio.nombre}</Texto>
            <View style={estilos.fila}>
              <Badge texto={estadoDe(desafio)} />
              {pendientes !== null && (
                <Badge
                  texto={
                    pendientes +
                    (pendientes === 1
                      ? " solicitud pendiente"
                      : " solicitudes pendientes")
                  }
                  tono={pendientes > 0 ? "advertencia" : "neutro"}
                />
              )}
            </View>
            <Texto variante="cuerpoSecundario" tono="textoSecundario">
              {desafio.participantes.length}/{desafio.maxParticipantes}{" "}
              participantes
            </Texto>
            {pendientes === null && (
              <>
                <Texto tono="error" variante="cuerpoSecundario">
                  No pudimos consultar las solicitudes.
                </Texto>
                <Boton
                  titulo="Reintentar contador"
                  secundario
                  onPress={carga.cargar}
                  disabled={carga.cargando}
                />
              </>
            )}
            <Boton
              titulo="Administrar solicitudes"
              onPress={() => setSeleccionado(desafio)}
            />
            <Boton
              titulo="Ver desafío"
              secundario
              onPress={() =>
                router.push({
                  pathname: "/desafio/[id]",
                  params: { id: desafio.id },
                })
              }
            />
          </Tarjeta>
        ))}
      {(carga.datos?.paginas ?? 0) > 1 && (
        <Paginador
          pagina={pagina}
          paginas={carga.datos?.paginas ?? 0}
          cambiar={setPagina}
          disabled={carga.cargando}
        />
      )}
    </View>
  );
}
