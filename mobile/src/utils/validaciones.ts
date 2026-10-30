import type { CrearDesafio } from "@/types";
import { hoy } from "./fechas";
export function validarDesafio(d: CrearDesafio) {
  if (d.nombre.trim().length < 3 || d.nombre.trim().length > 60)
    throw new Error("El nombre debe tener entre 3 y 60 caracteres.");
  if ((d.descripcion?.length ?? 0) > 280)
    throw new Error("La descripción admite hasta 280 caracteres.");
  const duracion =
    (Date.parse(d.fechaFin) - Date.parse(d.fechaInicio)) / 86400000 + 1;
  if (!Number.isFinite(duracion) || duracion < 3 || duracion > 90)
    throw new Error(
      "El desafío debe durar entre 3 y 90 días, contando inicio y fin.",
    );
  if (d.fechaInicio < hoy())
    throw new Error("La fecha de inicio no puede estar en el pasado.");
  if (
    !Number.isInteger(d.maxParticipantes) ||
    d.maxParticipantes! < 2 ||
    d.maxParticipantes! > 20
  )
    throw new Error("Elegí entre 2 y 20 participantes.");
}
export function validarPerfil(nombre: string, zona: string) {
  if (!nombre.trim()) throw new Error("Ingresá tu nombre.");
  try {
    new Intl.DateTimeFormat("es", { timeZone: zona }).format();
  } catch {
    throw new Error(
      "Ingresá una zona horaria IANA válida, por ejemplo America/Argentina/Buenos_Aires.",
    );
  }
}
export function validarRegistro(
  nombre: string,
  alias: string,
  email: string,
  zona: string,
) {
  validarPerfil(nombre, zona);
  if (!/^[A-Za-z0-9_]{3,20}$/.test(alias))
    throw new Error(
      "El alias debe tener de 3 a 20 letras, números o guion bajo.",
    );
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new Error("Ingresá un email válido.");
}
