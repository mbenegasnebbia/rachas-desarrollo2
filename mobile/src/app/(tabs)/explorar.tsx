import { router } from "expo-router";
import { useCallback, useState } from "react";

import { listarDesafios } from "@/api/desafios";
import { TarjetaDesafio } from "@/components/desafios/tarjetaDesafio";
import { AccesoDesafios } from "@/components/desafios/accesoDesafios";
import {
  Encabezado,
  IconoCircular,
  SeccionExpandible,
  EstadoCarga,
  Opciones,
  Paginador,
  Pantalla,
  useEstilos,
} from "@/components/ui";
import { Texto } from "@/components/ui/texto";
import { useCarga } from "@/hooks/useCarga";
import { useSesion } from "@/session/sesion";
import { useTema } from "@/theme/useTema";

const categorias = [
  "",
  "SALUD",
  "ESTUDIO",
  "FINANZAS",
  "BIENESTAR",
  "OTRO",
] as const;
const estados = [
  "",
  "PROGRAMADO",
  "ACTIVO",
  "FINALIZADO",
  "CANCELADO",
  "PAUSADO",
] as const;
export default function Explorar() {
  const estilos = useEstilos();
  const tema = useTema();

  const [categoria, setCategoria] = useState<string>(""),
    [estado, setEstado] = useState<string>(""),
    [pagina, setPagina] = useState(1);
  const [revisionSolicitudes, setRevisionSolicitudes] = useState(0);
  const carga = useCarga(
    useCallback(
      () => listarDesafios(pagina, estado, categoria),
      [pagina, estado, categoria],
    ),
  );
  const { persona, usuarioFirebase } = useSesion();
  return (
    <Pantalla
      refrescar={async () => {
        setRevisionSolicitudes((anterior) => anterior + 1);
        await carga.cargar();
      }}
      cargando={carga.cargando}
    >
      <IconoCircular icono="explorar" tono="primario" tamano="grande" />
      <Encabezado
        principal
        titulo="Encontrá tu próximo desafío"
        descripcion="Elegí tu próximo pequeño gran paso."
      />
      <AccesoDesafios
        key={(persona?.id ?? "") + ":" + (usuarioFirebase?.uid ?? "")}
        alSolicitar={carga.cargar}
        revision={revisionSolicitudes}
      />
      <SeccionExpandible
        titulo="Filtros"
        resumen="Por categoría y estado"
        inicialmenteExpandida
      >
        <Texto style={estilos.etiqueta}>Categoría</Texto>
        <Opciones
          variante="seleccion"
          valores={categorias}
          valor={categoria}
          cambiar={(v) => {
            setCategoria(v);
            setPagina(1);
          }}
        />
        <Texto style={[estilos.etiqueta, { marginTop: tema.espacios.sm }]}>
          Estado
        </Texto>
        <Opciones
          variante="acento"
          valores={estados}
          valor={estado}
          cambiar={(v) => {
            setEstado(v);
            setPagina(1);
          }}
        />
      </SeccionExpandible>
      <EstadoCarga
        {...carga}
        vacio={carga.datos?.items.length === 0}
        reintentar={carga.cargar}
      />
      {!carga.error &&
        carga.datos?.items.map((d) => (
          <TarjetaDesafio
            key={d.id}
            desafio={d}
            personaId={persona?.id}
            abrir={() =>
              router.push({ pathname: "/desafio/[id]", params: { id: d.id } })
            }
          />
        ))}
      <Paginador
        pagina={pagina}
        paginas={carga.datos?.paginas ?? 0}
        cambiar={setPagina}
        disabled={carga.cargando}
      />
    </Pantalla>
  );
}
