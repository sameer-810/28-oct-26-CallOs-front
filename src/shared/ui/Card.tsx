import type { ReactNode } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import { palette, radius, space } from "../designSystem";

/** Raised surface with a hairline border. No shadow: rules, not depth. */
export function Card({ children, style, padded = true }: { children: ReactNode; style?: ViewStyle; padded?: boolean }) {
  return <View style={[styles.card, padded && styles.padded, style]}>{children}</View>;
}

export function Rule({ style }: { style?: ViewStyle }) {
  return <View style={[styles.rule, style]} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.ruleStrong,
    borderRadius: radius.lg,
  },
  padded: { padding: space.lg + 2 },
  rule: { height: 1, backgroundColor: palette.rule },
});
