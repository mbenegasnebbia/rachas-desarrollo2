import { useCallback, useState } from "react";
import { Text } from "react-native";
import { obtenerPersona, actualizarPersona, resultados } from "@/api/personas";
import { useSesion } from "@/session/Sesion";
import { useCarga, useAccion } from "@/hooks/useCarga";
import {
  Aviso,
  Boton,
  Campo,
  EstadoCarga,
  Pantalla,
  TarjetaDesafio,
  estilos,
} from "@/components/UI";
import { validarPerfil } from "@/utils/validaciones";
import { router } from "expo-router";
export default function Perfil() {
  const sesion = useSesion();
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
      <Text style={estilos.titulo}>Tu perfil</Text>
      <Text style={estilos.texto}>@{sesion.persona?.alias}</Text>
      <EstadoCarga {...carga} reintentar={carga.cargar} />
      <Campo etiqueta="Nombre" value={nombre} onChangeText={setNombre} />
      <Campo
        etiqueta="Zona horaria IANA"
        autoCapitalize="none"
        value={zona}
        onChangeText={setZona}
      />
      <Aviso texto={accion.error} />
      <Text style={estilos.texto}>{aviso}</Text>
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
      <Text style={estilos.subtitulo}>Desafíos finalizados</Text>
      {carga.datos?.resultados.length === 0 && (
        <Text style={estilos.texto}>Todavía no terminaste ningún desafío.</Text>
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
          <Text style={estilos.texto}>
            Puesto {r.resultado?.posicion} · {r.resultado?.puntos} puntos ·
            Mejor racha {r.resultado?.mejorRacha}
          </Text>
          <Text style={estilos.texto}>
            Ganador: @{r.ganador?.alias ?? "sin participantes"}
          </Text>
        </TarjetaDesafio>
      ))}
      <Boton
        titulo="Cerrar sesión / Cambiar persona"
        secundario
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
