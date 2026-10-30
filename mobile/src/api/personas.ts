import { request } from "./client";
import type { Persona, CrearPersona, Resumen, Resultado } from "@/types";
export const listarPersonas = () => request<Persona[]>("/personas");
export const obtenerPersona = (id: string) =>
  request<Persona>(`/personas/${id}`);
export const registrar = (body: CrearPersona) =>
  request<Persona>("/personas", { method: "POST", body });
export const actualizarPersona = (
  id: string,
  body: Pick<Persona, "nombre" | "zonaHoraria">,
) => request<Persona>(`/personas/${id}`, { method: "PATCH", body });
export const resumen = () => request<Resumen[]>("/personas/me/resumen");
export const resultados = () => request<Resultado[]>("/personas/me/resultados");
