import { ActivityIndicator, Pressable, StyleSheet, View, type ViewStyle } from "react-native";
import { fonts, palette, radius } from "../designSystem";
import { Text } from "./Text";
import type { PressState } from "./useBreakpoint";

type Kind = "primary" | "ghost" | "danger" | "quiet";

interface Props {
  label: string;
  onPress?: () => void;
  kind?: Kind;
  loading?: boolean;
  disabled?: boolean;
  size?: "md" | "sm";
  style?: ViewStyle;
  accessibilityHint?: string;
  testID?: string;
}

export function Button({
  label,
  onPress,
  kind = "primary",
  loading,
  disabled,
  size = "md",
  style,
  accessibilityHint,
  testID,
}: Props) {
  const off = disabled || loading;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      aria-disabled={!!off}
      aria-busy={!!loading}
      disabled={off}
      onPress={onPress}
      style={({ pressed, hovered }: PressState) => [
        styles.base,
        size === "sm" && styles.sm,
        styles[kind],
        (hovered || pressed) && !off && hoverStyle[kind],
        pressed && !off && { transform: [{ translateY: 1 }] },
        off && styles.off,
        style,
      ]}
    >
      <View style={styles.row}>
        {loading ? (
          <ActivityIndicator
            size="small"
            color={kind === "primary" || kind === "danger" ? palette.paper : palette.ink}
          />
        ) : null}
        <Text
          style={[styles.label, size === "sm" && styles.labelSm]}
          tone={kind === "primary" || kind === "danger" ? "inverse" : "primary"}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    paddingHorizontal: 20,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "transparent",
  },
  sm: { minHeight: 36, paddingHorizontal: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  primary: { backgroundColor: palette.ink },
  ghost: { borderColor: palette.ruleStrong, backgroundColor: "transparent" },
  danger: { backgroundColor: palette.missed },
  quiet: { backgroundColor: "transparent", paddingHorizontal: 8 },
  off: { opacity: 0.5 },
  label: { fontFamily: fonts.textMedium, fontSize: 15 },
  labelSm: { fontSize: 13 },
});

const hoverStyle = StyleSheet.create({
  primary: { backgroundColor: "#2E2A23" },
  ghost: { borderColor: palette.ink, backgroundColor: palette.card },
  danger: { backgroundColor: "#962019" },
  quiet: { backgroundColor: palette.paper2 },
});
