import type { Desafio, Pagina, SolicitudAcceso } from "@/types";

import { request } from "./client";

export const solicitarAcceso = (codigo: string, expectedUid?: string) =>
  request<SolicitudAcceso>("/solicitudes", {
    method: "POST",
    body: { codigo: codigo.trim().toUpperCase() },
    expectedUid,
  });

export const listarSolicitudesPropias = (pagina = 1, expectedUid?: string) =>
  request<Pagina<SolicitudAcceso>>(
    "/solicitudes?pagina=" + pagina + "&limite=50",
    { expectedUid },
  );

export const cancelarSolicitud = (id: string, expectedUid?: string) =>
  request<SolicitudAcceso>(
    "/solicitudes/" + encodeURIComponent(id) + "/cancelar",
    { method: "PATCH", expectedUid },
  );

export const listarCreados = (pagina = 1, expectedUid?: string) =>
  request<Pagina<Desafio>>(
    "/desafios/creados?pagina=" + pagina + "&limite=10",
    { expectedUid },
  );

export const listarSolicitudesRecibidas = (
  id: string,
  pagina = 1,
  limite = 10,
  expectedUid?: string,
) =>
  request<Pagina<SolicitudAcceso>>(
    "/desafios/" +
      encodeURIComponent(id) +
      "/solicitudes?pagina=" +
      pagina +
      "&limite=" +
      limite,
    { expectedUid },
  );

export const resolverSolicitud = (
  desafioId: string,
  solicitudId: string,
  decision: "aprobar" | "rechazar",
  expectedUid?: string,
) =>
  request<SolicitudAcceso>(
    "/desafios/" +
      encodeURIComponent(desafioId) +
      "/solicitudes/" +
      encodeURIComponent(solicitudId) +
      "/" +
      decision,
    { method: "PATCH", expectedUid },
  );

export const listarParticipaciones = (
  personaId: string,
  expectedUid?: string,
) =>
  request<Desafio[]>(
    "/personas/" + encodeURIComponent(personaId) + "/desafios",
    { expectedUid },
  );

// The backend does not filter own requests by state. Traverse every page, deduplicate,
// then let the view filter: pending requests may follow many resolved ones. No polling or storage.
export async function listarTodasSolicitudesPropias(expectedUid?: string) {
  const primera = await listarSolicitudesPropias(1, expectedUid);
  const solicitudes = new Map(primera.items.map((s) => [s.id, s]));
  for (let pagina = 2; pagina <= primera.paginas; pagina++) {
    const respuesta = await listarSolicitudesPropias(pagina, expectedUid);
    respuesta.items.forEach((s) => solicitudes.set(s.id, s));
  }
  return [...solicitudes.values()];
}
