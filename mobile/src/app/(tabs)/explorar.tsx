import { router } from "expo-router";
import { useCallback, useState } from "react";

import { listarDesafios } from "@/api/desafios";
import { TarjetaDesafio } from "@/components/desafios/tarjetaDesafio";
import { UnirseFormulario } from "@/components/desafios/unirseFormulario";
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

  const [categoria, setCategoria] = useState<string>(""),
    [estado, setEstado] = useState<string>(""),
    [pagina, setPagina] = useState(1);
  const carga = useCarga(
    useCallback(
      () => listarDesafios(pagina, estado, categoria),
      [pagina, estado, categoria],
    ),
  );
  const { persona } = useSesion();
  return (
    <Pantalla refrescar={carga.cargar} cargando={carga.cargando}>
      <IconoCircular icono="explorar" tono="primario" tamano="grande" />
      <Encabezado
        principal
        titulo="Encontrá tu próximo desafío"
        descripcion="Elegí tu próximo pequeño gran paso."
      />
      <UnirseFormulario
        alUnirse={(d) =>
          router.push({ pathname: "/desafio/[id]", params: { id: d.id } })
        }
      />
      <SeccionExpandible
        titulo="Filtros"
        resumen="Por categoría y estado"
        inicialmenteExpandida
      >
        <Texto style={estilos.etiqueta}>Categoría</Texto>
        <Opciones
          valores={categorias}
          valor={categoria}
          cambiar={(v) => {
            setCategoria(v);
            setPagina(1);
          }}
        />
        <Texto style={estilos.etiqueta}>Estado</Texto>
        <Opciones
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
