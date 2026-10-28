import { Text as RNText, StyleSheet, type TextProps, type TextStyle } from "react-native";
import { fonts, palette } from "../designSystem";

type Variant =
  | "display"
  | "title"
  | "heading"
  | "body"
  | "bodyMedium"
  | "label"
  | "caption"
  | "eyebrow"
  | "mono"
  | "monoLarge";

type Tone = "primary" | "secondary" | "tertiary" | "connected" | "missed" | "inverse";

interface Props extends TextProps {
  variant?: Variant;
  tone?: Tone;
  align?: TextStyle["textAlign"];
}

const toneColor: Record<Tone, string> = {
  primary: palette.ink,
  secondary: palette.ink2,
  tertiary: palette.ink3,
  connected: palette.connected,
  missed: palette.missed,
  inverse: palette.paper,
};

export function Text({ variant = "body", tone = "primary", align, style, ...rest }: Props) {
  const role = variant === "display" || variant === "title" ? "header" : undefined;
  return (
    <RNText
      accessibilityRole={role}
      {...rest}
      style={[styles[variant], { color: toneColor[tone] }, align ? { textAlign: align } : null, style]}
    />
  );
}

const styles = StyleSheet.create({
  display: { fontFamily: fonts.display, fontSize: 40, lineHeight: 42, letterSpacing: -0.8 },
  title: { fontFamily: fonts.display, fontSize: 30, lineHeight: 34, letterSpacing: -0.5 },
  heading: { fontFamily: fonts.textSemi, fontSize: 16, lineHeight: 22 },
  body: { fontFamily: fonts.text, fontSize: 15, lineHeight: 22 },
  bodyMedium: { fontFamily: fonts.textMedium, fontSize: 15, lineHeight: 22 },
  label: { fontFamily: fonts.textMedium, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: fonts.text, fontSize: 13, lineHeight: 18 },
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  mono: { fontFamily: fonts.mono, fontSize: 13, lineHeight: 18 },
  monoLarge: { fontFamily: fonts.monoMedium, fontSize: 30, lineHeight: 34, letterSpacing: 4 },
});
