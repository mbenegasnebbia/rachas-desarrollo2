export function hoyEn(
  zonaHoraria = 'America/Argentina/Buenos_Aires',
  ahora = new Date(),
): string {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: zonaHoraria,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(ahora);
  const parte = (tipo: string) => partes.find((p) => p.type === tipo)!.value;
  return `${parte('year')}-${parte('month')}-${parte('day')}`;
}
export function moverDia(fecha: string, dias: number): string {
  const d = new Date(fecha + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}
export function estadoDe(
  d: { cancelado: boolean; fechaInicio: Date; fechaFin: Date },
  hoy = hoyEn(),
) {
  return d.cancelado
    ? 'CANCELADO'
    : hoy < d.fechaInicio.toISOString().slice(0, 10)
      ? 'PROGRAMADO'
      : hoy > d.fechaFin.toISOString().slice(0, 10)
        ? 'FINALIZADO'
        : 'ACTIVO';
}
export function estadisticas(
  registros: { fecha: string; puntos?: number }[],
  hoy: string,
) {
  const fechas = [...new Set(registros.map((c) => c.fecha))].sort();
  let mejorRacha = 0,
    consecutivos = 0;
  fechas.forEach((fecha, i) => {
    consecutivos =
      i > 0 && moverDia(fechas[i - 1], 1) === fecha ? consecutivos + 1 : 1;
    mejorRacha = Math.max(mejorRacha, consecutivos);
  });
  const dias = new Set(fechas);
  let cursor = dias.has(hoy) ? hoy : moverDia(hoy, -1),
    rachaActual = 0;
  while (dias.has(cursor)) {
    rachaActual++;
    cursor = moverDia(cursor, -1);
  }
  return {
    // Representation metadata only: totals, ordering and scoring remain unchanged.
    _bonusPorRacha: registros.reduce(
      (sum, c) => sum + Math.max(0, (c.puntos ?? 0) - 10),
      0,
    ),
    puntos: registros.reduce((s, c) => s + (c.puntos ?? 0), 0),
    rachaActual,
    mejorRacha,
    checkinHoy: dias.has(hoy),
  };
}
export function puntosPara(racha: number) {
  return 10 + (racha >= 7 ? 10 : racha >= 3 ? 5 : 0);
}
