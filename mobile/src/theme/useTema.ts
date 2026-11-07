import { useWindowDimensions } from "react-native";

import { temaParaAncho } from "./index";

export function useTema() {
  const { width, fontScale } = useWindowDimensions();
  return temaParaAncho(width, fontScale);
}
