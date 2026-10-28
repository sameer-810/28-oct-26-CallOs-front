import { Pressable, StyleSheet, View } from "react-native";
import { fonts, palette, radius } from "../designSystem";
import type { PressState } from "./useBreakpoint";
import { Text } from "./Text";

export const TONE_COLOR: Record<string, string> = {
  hot: "#B3261E",
  warm: "#B25000",
  cold: "#2F5D8A",
  caution: "#8A5304",
  missed: "#B3261E",
  connected: "#2C6B43",
  neutral: "#776F61",
};

interface Props {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  /** A dot in the status's colour, beside the word — never colour alone. */
  tone?: string;
  role?: "radio" | "checkbox" | "button";
}

export function Chip({ label, selected, onPress, tone, role = "button" }: Props) {
  return (
    <Pressable
      accessibilityRole={role}
      // a toggle button is pressed; a radio or checkbox is checked
      aria-pressed={role === "button" && selected !== undefined ? selected : undefined}
      aria-checked={role !== "button" ? !!selected : undefined}
      onPress={onPress}
      style={({ hovered }: PressState) => [styles.chip, selected && styles.on, hovered && !selected && styles.hover]}
    >
      {tone ? <View style={[styles.dot, { backgroundColor: TONE_COLOR[tone] ?? palette.ink3 }]} /> : null}
      <Text style={[styles.text, selected && styles.textOn]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: palette.ruleStrong,
    backgroundColor: palette.card,
  },
  hover: { borderColor: palette.ink },
  on: { backgroundColor: palette.ink, borderColor: palette.ink },
  dot: { width: 7, height: 7, borderRadius: 4 },
  text: { fontFamily: fonts.textMedium, fontSize: 12.5, color: palette.ink },
  textOn: { color: palette.paper },
});
