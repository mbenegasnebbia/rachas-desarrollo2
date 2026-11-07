import { paletas, neutros, sobreMarca } from "./paletas";
import {
  espacios,
  radios,
  medidas,
  tipografia,
  iconos,
  circulos,
  interaccion,
  breakpoints,
  crearTipografia,
  geometriaCompacta,
} from "./tokens";

export function crearTema(
  paleta: keyof typeof paletas,
  modo: keyof typeof neutros,
) {
  return {
    colores: {
      ...neutros[modo],
      ...paletas[paleta],
      fondoPrimarioSuave:
        paletas[paleta].primario + (modo === "claro" ? "20" : "26"),
      fondoSecundarioSuave:
        paletas[paleta].secundario + (modo === "claro" ? "20" : "26"),
      sobrePrimario: sobreMarca,
      sobreSecundario: sobreMarca,
      sobreAcento: sobreMarca,
    },
    espacios,
    radios,
    medidas,
    tipografia,
    iconos,
    circulos,
    interaccion,
  };
}
// Change only this line to preview the other palette or prepared dark tokens.
export const tema = crearTema("neonClub", "claro");

// One breakpoint shared by Web and native; font scaling is never disabled.
export function temaParaAncho(ancho: number, fontScale = 1) {
  const compacto = ancho <= breakpoints.compacto;
  const geometria = compacto
    ? geometriaCompacta
    : { medidas: tema.medidas, circulos: tema.circulos };
  return {
    ...tema,
    ...geometria,
    compacto,
    medidas: {
      ...geometria.medidas,
      baseEstadistica:
        geometria.medidas.baseEstadistica * Math.max(1, fontScale),
    },
    tipografia: crearTipografia(compacto),
  };
}
