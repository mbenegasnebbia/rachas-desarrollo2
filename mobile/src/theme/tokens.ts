import type { TextStyle } from "react-native";

export const breakpoints = { compacto: 375 };
export const espacios = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  intermedio: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
};
export const radios = { control: 16, tarjeta: 24, circular: 999 };
export const medidas = {
  anchoContenido: 760,
  altoBoton: 52,
  toqueMinimo: 44,
  icono: 48,
  baseEstadistica: 72,
  margenPantalla: 24,
  paddingTarjeta: 20,
  espacioSeccion: 20,
  separacionSeccionDestacada: 36,
  espacioListado: 18,
  altoBarra: 80,
  columnasReacciones: 6,
};
export const iconos = {
  metrica: 24,
  pequeno: 18,
  mediano: 24,
  grande: 28,
  navegacion: 24,
  trazo: 2.3,
};
export const circulos = {
  metrica: 44,
  pequeno: 36,
  mediano: 44,
  grande: 52,
  navegacion: 56,
};
export const interaccion = { opacidadPresionado: 0.76, borde: 1, bordeFoco: 2 };
const pesos = {
  regular: { fontFamily: "PlusJakartaSans_400Regular", fontWeight: "400" },
  medio: { fontFamily: "PlusJakartaSans_600SemiBold", fontWeight: "600" },
  fuerte: { fontFamily: "PlusJakartaSans_700Bold", fontWeight: "700" },
  destacado: { fontFamily: "PlusJakartaSans_800ExtraBold", fontWeight: "800" },
} satisfies Record<string, TextStyle>;
export function crearTipografia(compacto: boolean) {
  const roles = {
    pantallaTitulo: {
      ...pesos.destacado,
      fontSize: compacto ? 25 : 32,
      lineHeight: compacto ? 32 : 40,
      letterSpacing: -0.7,
    },
    desafioTitulo: {
      ...pesos.fuerte,
      fontSize: compacto ? 20 : 24,
      lineHeight: compacto ? 27 : 32,
      letterSpacing: -0.4,
    },
    seccionDestacada: {
      ...pesos.destacado,
      fontSize: compacto ? 22 : 24,
      lineHeight: compacto ? 30 : 32,
    },
    desafioListado: {
      ...pesos.fuerte,
      fontSize: compacto ? 17 : 18,
      lineHeight: compacto ? 24 : 25,
    },
    seccionTitulo: {
      ...pesos.fuerte,
      fontSize: compacto ? 18 : 22,
      lineHeight: compacto ? 25 : 30,
      letterSpacing: -0.3,
    },
    tarjetaTitulo: {
      ...pesos.fuerte,
      fontSize: compacto ? 17 : 20,
      lineHeight: compacto ? 24 : 28,
    },
    cuerpo: {
      ...pesos.regular,
      fontSize: compacto ? 14 : 16,
      lineHeight: compacto ? 21 : 25,
    },
    cuerpoSecundario: {
      ...pesos.regular,
      fontSize: compacto ? 13 : 14,
      lineHeight: compacto ? 19 : 21,
    },
    marca: {
      ...pesos.medio,
      fontSize: compacto ? 13 : 14,
      lineHeight: compacto ? 19 : 21,
    },
    etiqueta: {
      ...pesos.medio,
      fontSize: compacto ? 12 : 13,
      lineHeight: compacto ? 17 : 20,
    },
    boton: {
      ...pesos.fuerte,
      fontSize: compacto ? 14 : 16,
      lineHeight: compacto ? 21 : 24,
    },
    metricaNumero: { ...pesos.destacado, fontSize: 26, lineHeight: 34 },
    metricaEtiqueta: { ...pesos.medio, fontSize: 12, lineHeight: 18 },
    estadistica: {
      ...pesos.destacado,
      fontSize: compacto ? 26 : 32,
      lineHeight: compacto ? 33 : 40,
      letterSpacing: -0.6,
    },
  } satisfies Record<string, TextStyle>;
  // Compatibility aliases share the same semantic styles, never a separate scale.
  return {
    ...roles,
    titulo: roles.pantallaTitulo,
    seccion: roles.seccionTitulo,
    numero: roles.estadistica,
  };
}
export const tipografia = crearTipografia(false);
export const geometriaCompacta = {
  medidas: {
    ...medidas,
    altoBoton: 48,
    baseEstadistica: 64,
    margenPantalla: 16,
    paddingTarjeta: 16,
    espacioSeccion: 16,
    separacionSeccionDestacada: 32,
    espacioListado: 16,
    altoBarra: 76,
    columnasReacciones: 3,
  },
  circulos: {
    ...circulos,
    pequeno: 32,
    mediano: 40,
    grande: 48,
    navegacion: 52,
  },
};
