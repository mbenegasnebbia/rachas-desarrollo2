// Display-only: never changes the stored Persona name.
export function primerNombreVisible(nombre?: string | null): string {
  return nombre?.trim().split(/\s+/u)[0] ?? "";
}
