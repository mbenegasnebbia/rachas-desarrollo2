import { router } from "expo-router";
import { useState } from "react";

import { MisCreados } from "@/components/desafios/misCreados";
import { useSesion } from "@/session/sesion";
import { crearDesafio } from "@/api/desafios";
import {
  Encabezado,
  IconoCircular,
  Seccion,
  Aviso,
  Boton,
  Campo,
  Opciones,
  Pantalla,
} from "@/components/ui";
import { FechaSelector } from "@/components/ui/fechaSelector";
import { useAccion } from "@/hooks/useCarga";
import type { Categoria } from "@/types";
import { hoy, moverDia } from "@/utils/fechas";
import { validarDesafio } from "@/utils/validaciones";

export default function Crear() {
  const [nombre, setNombre] = useState(""),
    [descripcion, setDescripcion] = useState(""),
    [categoria, setCategoria] = useState<Categoria>("SALUD"),
    [inicio, setInicio] = useState(hoy()),
    [fin, setFin] = useState(moverDia(hoy(), 6)),
    [cupo, setCupo] = useState("10");
  const accion = useAccion();
  const [vista, setVista] = useState<"Crear" | "Mis creados">("Crear");
  const { persona, usuarioFirebase } = useSesion();
  return (
    <Pantalla>
      <IconoCircular icono="crear" tono="primario" tamano="grande" />
      <Encabezado
        principal
        titulo="Un nuevo comienzo"
        descripcion="Dale forma a un hábito que quieras sostener."
      />
      <Opciones
        valores={["Crear", "Mis creados"] as const}
        valor={vista}
        cambiar={setVista}
      />
      {vista === "Crear" ? (
        <>
          <Seccion titulo="El desafío">
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
              valores={
                ["SALUD", "ESTUDIO", "FINANZAS", "BIENESTAR", "OTRO"] as const
              }
              valor={categoria}
              cambiar={setCategoria}
            />
          </Seccion>
          <Seccion titulo="Duración">
            <FechaSelector
              etiqueta="Fecha de inicio"
              valor={inicio}
              cambiar={setInicio}
            />
            <FechaSelector
              etiqueta="Fecha de fin"
              valor={fin}
              cambiar={setFin}
            />
          </Seccion>
          <Seccion titulo="Compartilo">
            <Campo
              etiqueta="Participantes (2 a 20)"
              keyboardType="number-pad"
              value={cupo}
              onChangeText={setCupo}
            />
          </Seccion>
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
                router.push({
                  pathname: "/desafio/[id]",
                  params: { id: d.id },
                });
              })
            }
          />
        </>
      ) : (
        <MisCreados
          key={(persona?.id ?? "") + ":" + (usuarioFirebase?.uid ?? "")}
        />
      )}
    </Pantalla>
  );
}
