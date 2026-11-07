import { track, analyticsContext } from "@/analytics/runtime";
import { request } from "./client";
import type {
  Desafio,
  CrearDesafio,
  Pagina,
  Ranking,
  Participante,
} from "@/types";
export const listarDesafios = (pagina = 1, estado = "", categoria = "") =>
  request<Pagina<Desafio>>(
    `/desafios?pagina=${pagina}&limite=10&estado=${estado}&categoria=${categoria}`.replace(
      /&(estado|categoria)=(?=&|$)/g,
      "",
    ),
  );
export const obtenerDesafio = (id: string) =>
  request<Desafio>(`/desafios/${id}`);
export const crearDesafio = async (body: CrearDesafio) => {
  const context = analyticsContext();
  const result = await request<Desafio>("/desafios", { method: "POST", body });
  track(
    "desafio_creado",
    { desafio_id: result.id, categoria: result.categoria },
    context,
  );
  return result;
};
export const editarDesafio = (id: string, body: Partial<CrearDesafio>) =>
  request<Desafio>(`/desafios/${id}`, { method: "PATCH", body });
export const abandonar = (id: string) =>
  request<Desafio>(`/desafios/${id}/abandonar`, { method: "POST" });
export const cancelar = (id: string) =>
  request<Desafio>(`/desafios/${id}/cancelar`, { method: "PATCH" });
export const participantes = (id: string) =>
  request<Participante[]>(`/desafios/${id}/participantes`);
export const ranking = async (id: string) => {
  const context = analyticsContext();
  const result = await request<Ranking>(`/desafios/${id}/ranking`);
  track("ranking_consultado", { desafio_id: id }, context);
  return result;
};
