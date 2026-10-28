import { StyleSheet, View } from "react-native";
import { palette, radius, space } from "../designSystem";
import { Text } from "./Text";

type Tone = "error" | "info" | "success";

/** An inline message with a coloured edge. Announced to screen readers. */
export function Banner({ tone = "info", message, title }: { tone?: Tone; message: string; title?: string }) {
  const edge = tone === "error" ? palette.missed : tone === "success" ? palette.connected : palette.marker;
  const bg = tone === "error" ? palette.missedBg : tone === "success" ? palette.connectedBg : palette.markerSoft;
  return (
    <View
      accessibilityRole={tone === "error" ? "alert" : "summary"}
      accessibilityLiveRegion="polite"
      style={[styles.box, { borderLeftColor: edge, backgroundColor: bg }]}
    >
      {title ? <Text variant="heading">{title}</Text> : null}
      <Text variant="caption" tone="primary">
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderLeftWidth: 3,
    borderRadius: radius.sm,
    paddingVertical: space.md,
    paddingHorizontal: space.md + 2,
    gap: 2,
  },
});
