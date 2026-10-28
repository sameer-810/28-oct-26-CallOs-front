import { useWindowDimensions } from "react-native";
import { WIDE } from "../designSystem";

export function useBreakpoint() {
  const { width } = useWindowDimensions();
  return { width, isWide: width >= WIDE };
}

/** Pressable state on web also carries `hovered` (react-native-web); native never sets it. */
export type PressState = { pressed: boolean; hovered?: boolean };
