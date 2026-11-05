import { useCallback, useState } from "react";
import { router } from "expo-router";
import { Text } from "react-native";
import { listarDesafios } from "@/api/desafios";
import { UnirseFormulario } from "@/components/UnirseFormulario";
import { useSesion } from "@/session/Sesion";
import { useCarga } from "@/hooks/useCarga";
import {
  EstadoCarga,
  Opciones,
  Paginador,
  Pantalla,
  TarjetaDesafio,
  estilos,
} from "@/components/UI";
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
] as const;
export default function Explorar() {
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
      <Text style={estilos.titulo}>Encontrá tu próximo desafío</Text>
      <UnirseFormulario
        alUnirse={(d) =>
          router.push({ pathname: "/desafio/[id]", params: { id: d.id } })
        }
      />
      <Text style={estilos.etiqueta}>Categoría</Text>
      <Opciones
        valores={categorias}
        valor={categoria}
        cambiar={(v) => {
          setCategoria(v);
          setPagina(1);
        }}
      />
      <Text style={estilos.etiqueta}>Estado</Text>
      <Opciones
        valores={estados}
        valor={estado}
        cambiar={(v) => {
          setEstado(v);
          setPagina(1);
        }}
      />
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
