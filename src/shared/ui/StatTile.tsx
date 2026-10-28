import { Pressable, StyleSheet, View } from "react-native";
import { fonts, palette, space } from "../designSystem";
import { Text } from "./Text";

interface Props {
  label: string;
  value: string;
  /** Small text after the value: "74%", "/ 63". */
  aside?: string;
  delta?: { text: string; up: boolean; flat: boolean } | null;
  /** For counts where up is bad (missed calls). */
  upIsBad?: boolean;
  /** A coloured mark beside the label for call-state metrics. */
  mark?: "connected" | "missed";
  big?: boolean;
  onPress?: () => void;
  hint?: string;
}

/** One number with its label, and how it moved against the previous period. */
export function StatTile({ label, value, aside, delta, upIsBad, mark, big, onPress, hint }: Props) {
  const good = delta && !delta.flat ? delta.up !== !!upIsBad : null;
  const body = (
    <View style={[styles.tile, big && styles.big]}>
      <View style={styles.labelRow}>
        {mark ? <View style={[styles.mark, mark === "missed" ? styles.markMissed : styles.markConnected]} /> : null}
        <Text variant="caption" tone="tertiary" numberOfLines={1} style={{ flexShrink: 1 }}>
          {label}
        </Text>
      </View>
      <View style={styles.valueRow}>
        <Text style={[styles.value, big && styles.valueBig]} numberOfLines={1}>
          {value}
        </Text>
        {aside ? <Text style={styles.aside}>{aside}</Text> : null}
      </View>
      {delta ? (
        <Text style={[styles.delta, good === true && styles.good, good === false && styles.bad]}>
          {delta.text} <Text style={styles.deltaVs}>vs previous</Text>
        </Text>
      ) : hint ? (
        <Text style={styles.deltaVs}>{hint}</Text>
      ) : null}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label}: ${value}. Open list`} style={{ flex: 1 }}>
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: { flex: 1, minWidth: 140, paddingVertical: space.md + 2, paddingHorizontal: space.lg, gap: 6 },
  big: { minWidth: 220 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  mark: { width: 8, height: 8 },
  markConnected: { backgroundColor: palette.connected, borderRadius: 2 },
  markMissed: { backgroundColor: palette.missed, borderRadius: 4 },
  valueRow: { flexDirection: "row", alignItems: "baseline", gap: 6 },
  value: { fontFamily: fonts.monoMedium, fontSize: 24, color: palette.ink, letterSpacing: -0.5 },
  valueBig: { fontFamily: fonts.display, fontSize: 56, lineHeight: 58, letterSpacing: -1.5 },
  aside: { fontFamily: fonts.mono, fontSize: 12, color: palette.ink3 },
  delta: { fontFamily: fonts.monoMedium, fontSize: 11, color: palette.ink3 },
  deltaVs: { fontFamily: fonts.mono, fontSize: 11, color: palette.ink3 },
  good: { color: palette.connected },
  bad: { color: palette.missed },
});
