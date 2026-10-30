import { request } from "./client";
import type { Desafio, CrearDesafio, Pagina, Ranking, Persona } from "@/types";
export const listarDesafios = (pagina = 1, estado = "", categoria = "") =>
  request<Pagina<Desafio>>(
    `/desafios?pagina=${pagina}&limite=10&estado=${estado}&categoria=${categoria}`.replace(
      /&(estado|categoria)=(?=&|$)/g,
      "",
    ),
  );
export const obtenerDesafio = (id: string) =>
  request<Desafio>(`/desafios/${id}`);
export const crearDesafio = (body: CrearDesafio) =>
  request<Desafio>("/desafios", { method: "POST", body });
export const editarDesafio = (id: string, body: Partial<CrearDesafio>) =>
  request<Desafio>(`/desafios/${id}`, { method: "PATCH", body });
export const unirse = (codigo: string) =>
  request<Desafio>(
    `/desafios/unirse/${encodeURIComponent(codigo.trim().toUpperCase())}`,
    { method: "POST" },
  );
export const abandonar = (id: string) =>
  request<Desafio>(`/desafios/${id}/abandonar`, { method: "POST" });
export const cancelar = (id: string) =>
  request<Desafio>(`/desafios/${id}/cancelar`, { method: "PATCH" });
export const participantes = (id: string) =>
  request<Persona[]>(`/desafios/${id}/participantes`);
export const ranking = (id: string) =>
  request<Ranking>(`/desafios/${id}/ranking`);
