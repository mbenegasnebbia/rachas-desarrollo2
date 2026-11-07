import type { ColorValue } from "react-native";
import Svg, { Path } from "react-native-svg";

import { useTema } from "@/theme/useTema";

// Small app-owned set. Paths share a 24 x 24 viewBox and rounded strokes.
const trazos = {
  chevronAbajo: "m6 9 6 6 6-6",
  chevronArriba: "m6 15 6-6 6 6",
  fuego:
    "M12 3c1 4-3 5-3 8 0 1 1 2 2 2 2 0 3-2 3-4 3 3 5 5 5 8a7 7 0 0 1-14 0c0-5 5-7 7-14Z",
  check: "m5 12 4 4L19 6",
  trofeo:
    "M8 3h8v6a4 4 0 0 1-8 0V3Zm0 2H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4m-4 1v7m-4 1h8",
  rayo: "m13 2-8 12h6l-1 8 9-13h-7l1-7Z",
  inicio: "m3 10 9-7 9 7M5 9v12h5v-7h4v7h5V9",
  explorar: "M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0ZM16 8l-3 5-5 3 3-5 5-3Z",
  crear: "M12 4v16M4 12h16",
  perfil: "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-2a8 8 0 0 1 16 0v2",
  llave: "M14 8a5 5 0 1 1-3-5 5 5 0 0 1 3 5Zm-2 4L3 21H1v-3l3-3h3v-3h3",
  calendario:
    "M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2ZM7 3v4m10-4v4M3 11h18",
  puntos: "m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1 3-6Z",
} as const;
export type NombreIcono = keyof typeof trazos;
interface Props {
  nombre: NombreIcono;
  size?: number;
  color?: ColorValue;
}

export function Icono({
  nombre,
  size,
  color,
}: Props) {
  const tema = useTema();

  return (
    <Svg
      width={size ?? tema.iconos.mediano}
      height={size ?? tema.iconos.mediano}
      viewBox="0 0 24 24"
      fill="none"
      accessible={false}
    >
      <Path
        d={trazos[nombre]}
        stroke={color ?? tema.colores.texto}
        strokeWidth={tema.iconos.trazo}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
