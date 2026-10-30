import { useCallback, useState } from "react";
import { router } from "expo-router";
import { Text, View } from "react-native";
import { listarDesafios, unirse } from "@/api/desafios";
import { useCarga, useAccion } from "@/hooks/useCarga";
import {
  Aviso,
  Boton,
  Campo,
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
    [pagina, setPagina] = useState(1),
    [codigo, setCodigo] = useState("");
  const carga = useCarga(
    useCallback(
      () => listarDesafios(pagina, estado, categoria),
      [pagina, estado, categoria],
    ),
  );
  const accion = useAccion();
  return (
    <Pantalla refrescar={carga.cargar} cargando={carga.cargando}>
      <Text style={estilos.titulo}>Encontrá tu próximo desafío</Text>
      <View style={estilos.tarjeta}>
        <Campo
          etiqueta="Código de invitación"
          autoCapitalize="characters"
          maxLength={6}
          value={codigo}
          onChangeText={setCodigo}
        />
        <Aviso texto={accion.error} />
        <Boton
          titulo="Unirme"
          disabled={accion.ocupado}
          onPress={() =>
            void accion.ejecutar(async () => {
              if (!/^[a-z0-9]{6}$/i.test(codigo.trim()))
                throw new Error("Ingresá un código de 6 letras o números.");
              const d = await unirse(codigo);
              router.push({ pathname: "/desafio/[id]", params: { id: d.id } });
            })
          }
        />
      </View>
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
