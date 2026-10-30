import {
  estadisticas,
  hoyEn,
  moverDia,
  puntosPara,
  estadoDe,
} from './calendario';
describe('Puntos y rachas', () => {
  it.each([
    [1, 10],
    [2, 10],
    [3, 15],
    [6, 15],
    [7, 20],
    [20, 20],
  ])('racha %i suma %i puntos', (racha, puntos) =>
    expect(puntosPara(racha)).toBe(puntos),
  );
  it('mantiene viva la racha de ayer, pero corta una anterior', () => {
    const registros = [
      { fecha: '2026-10-28', puntos: 10 },
      { fecha: '2026-10-29', puntos: 10 },
    ];
    expect(estadisticas(registros, '2026-10-30')).toEqual({
      puntos: 20,
      rachaActual: 2,
      mejorRacha: 2,
      checkinHoy: false,
    });
    expect(estadisticas(registros, '2026-10-31').rachaActual).toBe(0);
  });
  it('calcula la mejor racha y soporta registros desordenados', () => {
    const fechas = [
      '2026-10-30',
      '2026-10-22',
      '2026-10-20',
      '2026-10-21',
      '2026-10-29',
    ];
    expect(
      estadisticas(
        fechas.map((fecha) => ({ fecha })),
        '2026-10-30',
      ),
    ).toEqual({ puntos: 0, rachaActual: 2, mejorRacha: 3, checkinHoy: true });
  });
  it('resuelve mes, año y año bisiesto sin depender de la zona del servidor', () => {
    expect(moverDia('2024-03-01', -1)).toBe('2024-02-29');
    expect(moverDia('2026-01-01', -1)).toBe('2025-12-31');
    expect(
      hoyEn('America/Argentina/Buenos_Aires', new Date('2026-10-30T01:00:00Z')),
    ).toBe('2026-10-29');
    expect(hoyEn('Asia/Tokyo', new Date('2026-10-30T01:00:00Z'))).toBe(
      '2026-10-30',
    );
  });
  it('no cuenta días futuros y devuelve cero sin check-ins', () => {
    expect(estadisticas([], '2026-10-30')).toEqual({
      puntos: 0,
      rachaActual: 0,
      mejorRacha: 0,
      checkinHoy: false,
    });
  });
  it('calcula estado con fechas inclusivas y prioriza cancelación', () => {
    const d = {
      cancelado: false,
      fechaInicio: new Date('2026-10-20'),
      fechaFin: new Date('2026-10-30'),
    };
    expect(estadoDe(d, '2026-10-30')).toBe('ACTIVO');
    expect(estadoDe(d, '2026-10-31')).toBe('FINALIZADO');
    expect(estadoDe({ ...d, cancelado: true }, '2026-10-31')).toBe('CANCELADO');
  });
});
