import { request } from "./client";
import type { Persona, Resumen, Resultado } from "@/types";
export const obtenerPersona = (id: string) =>
  request<Persona>(`/personas/${id}`);
export const personaAutenticada = () => request<Persona>("/auth/persona");
export const completarPerfil = (body: { alias: string; nombre?: string; zonaHoraria?: string }) =>
  request<Persona>("/auth/perfil", { method: "PATCH", body });
export const actualizarPersona = (
  id: string,
  body: Pick<Persona, "nombre" | "zonaHoraria">,
) => request<Persona>(`/personas/${id}`, { method: "PATCH", body });
export const resumen = () => request<Resumen[]>("/personas/me/resumen");
export const resultados = () => request<Resultado[]>("/personas/me/resultados");
