import { StyleSheet } from "react-native";

import { tema } from "@/theme";
import { useTema } from "@/theme/useTema";

// Compatibility styles for existing screen layouts; values remain in the theme.
export function crearEstilos(temaActual: typeof tema) {
  const tema = temaActual;
  return StyleSheet.create({
    pantalla: { flex: 1, backgroundColor: tema.colores.fondo },
    contenido: {
      width: "100%",
      maxWidth: tema.medidas.anchoContenido,
      alignSelf: "center",
      padding: tema.medidas.margenPantalla,
      gap: tema.medidas.espacioSeccion,
      paddingBottom: tema.espacios.xxl,
    },
    seccion: { gap: tema.medidas.espacioSeccion },
    encabezadoListado: {
      paddingTop:
        tema.medidas.separacionSeccionDestacada - tema.medidas.espacioSeccion,
    },
    grupo: { gap: tema.espacios.sm },
    titulo: { ...tema.tipografia.titulo, color: tema.colores.texto },
    subtitulo: { ...tema.tipografia.seccion, color: tema.colores.texto },
    texto: { ...tema.tipografia.cuerpo, color: tema.colores.textoSecundario },
    etiqueta: {
      ...tema.tipografia.etiqueta,
      color: tema.colores.textoSecundario,
    },
    tarjeta: {
      padding: tema.medidas.paddingTarjeta,
      borderRadius: tema.radios.tarjeta,
      backgroundColor: tema.colores.superficie,
      gap: tema.espacios.lg,
      borderWidth: tema.interaccion.borde,
      borderColor: tema.colores.borde,
    },
    fila: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: tema.espacios.sm,
      alignItems: "center",
    },
    estadisticas: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: tema.espacios.md,
      alignItems: "flex-start",
    },
    metadato: {
      ...tema.tipografia.cuerpoSecundario,
      color: tema.colores.textoSecundario,
    },
    filaInfo: {
      paddingVertical: tema.espacios.sm,
      borderBottomWidth: tema.interaccion.borde,
      borderBottomColor: tema.colores.borde,
    },
    campo: {
      ...tema.tipografia.cuerpo,
      borderWidth: tema.interaccion.borde,
      borderColor: tema.colores.borde,
      borderRadius: tema.radios.control,
      padding: tema.espacios.md,
      minHeight: tema.medidas.altoBoton,
      color: tema.colores.texto,
      backgroundColor: tema.colores.superficie,
    },
    boton: {
      paddingVertical: tema.espacios.md,
      paddingHorizontal: tema.espacios.xl,
      minHeight: tema.medidas.altoBoton,
      borderRadius: tema.radios.circular,
      backgroundColor: tema.colores.primario,
      alignItems: "center",
      justifyContent: "center",
    },
    botonTexto: { ...tema.tipografia.boton, color: tema.colores.sobrePrimario },
    error: { ...tema.tipografia.cuerpo, color: tema.colores.error },
  });
}
export const estilos = crearEstilos(tema);
export function useEstilos() {
  return crearEstilos(useTema());
}
