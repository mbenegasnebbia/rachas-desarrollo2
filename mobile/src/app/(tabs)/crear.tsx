import { useState } from "react";
import { router } from "expo-router";
import { Text } from "react-native";
import { crearDesafio } from "@/api/desafios";
import { useAccion } from "@/hooks/useCarga";
import {
  Aviso,
  Boton,
  Campo,
  Opciones,
  Pantalla,
  estilos,
} from "@/components/UI";
import { FechaSelector } from "@/components/FechaSelector";
import { hoy, moverDia } from "@/utils/fechas";
import { validarDesafio } from "@/utils/validaciones";
import type { Categoria } from "@/types";
export default function Crear() {
  const [nombre, setNombre] = useState(""),
    [descripcion, setDescripcion] = useState(""),
    [categoria, setCategoria] = useState<Categoria>("SALUD"),
    [inicio, setInicio] = useState(hoy()),
    [fin, setFin] = useState(moverDia(hoy(), 6)),
    [cupo, setCupo] = useState("10");
  const accion = useAccion();
  return (
    <Pantalla>
      <Text style={estilos.titulo}>Un nuevo comienzo</Text>
      <Campo
        etiqueta="Nombre (3 a 60 caracteres)"
        value={nombre}
        onChangeText={setNombre}
        maxLength={60}
      />
      <Campo
        etiqueta="Descripción (opcional)"
        multiline
        value={descripcion}
        onChangeText={setDescripcion}
        maxLength={280}
      />
      <Opciones
        valores={["SALUD", "ESTUDIO", "FINANZAS", "BIENESTAR", "OTRO"] as const}
        valor={categoria}
        cambiar={setCategoria}
      />
      <FechaSelector
        etiqueta="Fecha de inicio"
        valor={inicio}
        cambiar={setInicio}
      />
      <FechaSelector etiqueta="Fecha de fin" valor={fin} cambiar={setFin} />
      <Campo
        etiqueta="Participantes (2 a 20)"
        keyboardType="number-pad"
        value={cupo}
        onChangeText={setCupo}
      />
      <Aviso texto={accion.error} />
      <Boton
        titulo={accion.ocupado ? "Creando…" : "Crear desafío"}
        disabled={accion.ocupado}
        onPress={() =>
          void accion.ejecutar(async () => {
            const body = {
              nombre: nombre.trim(),
              descripcion,
              categoria,
              fechaInicio: inicio,
              fechaFin: fin,
              maxParticipantes: Number(cupo),
            };
            validarDesafio(body);
            const d = await crearDesafio(body);
            setNombre("");
            setDescripcion("");
            router.push({ pathname: "/desafio/[id]", params: { id: d.id } });
          })
        }
      />
    </Pantalla>
  );
}
