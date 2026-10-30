import { request } from "./client";
import type { Checkin, CrearCheckin, Pagina } from "@/types";
export const historial = (id: string, personaId: string, pagina = 1) =>
  request<Pagina<Checkin>>(
    `/desafios/${id}/checkins?personaId=${personaId}&pagina=${pagina}&limite=10`,
  );
export const checkin = (id: string, body: CrearCheckin) =>
  request<Checkin>(`/desafios/${id}/checkins`, { method: "POST", body });
export const deshacer = (id: string) =>
  request<{ mensaje: string }>(`/desafios/${id}/checkins/ultimo`, {
    method: "DELETE",
  });
