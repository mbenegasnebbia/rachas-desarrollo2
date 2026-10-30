export function hoy(zonaHoraria = "America/Argentina/Buenos_Aires") {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: zonaHoraria,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const p = (tipo: string) => partes.find((p) => p.type === tipo)!.value;
  return `${p("year")}-${p("month")}-${p("day")}`;
}
export function moverDia(fecha: string, dias: number) {
  const d = new Date(fecha + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}
export function fechaVisible(fecha: string) {
  return fecha.slice(0, 10).split("-").reverse().join("/");
}
export function estadoDe(d: {
  cancelado: boolean;
  fechaInicio: string;
  fechaFin: string;
}) {
  const dia = hoy();
  return d.cancelado
    ? "CANCELADO"
    : dia < d.fechaInicio.slice(0, 10)
      ? "PROGRAMADO"
      : dia > d.fechaFin.slice(0, 10)
        ? "FINALIZADO"
        : "ACTIVO";
}
