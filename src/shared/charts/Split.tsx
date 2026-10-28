import { StyleSheet, View } from "react-native";
import { fonts, palette } from "../designSystem";
import { Text } from "../ui/Text";

export interface Part {
  label: string;
  value: number;
  color: string;
}

/**
 * One 100% bar split into parts, with a ledger underneath: label, count,
 * share. The ledger carries the meaning; the bar is the glance.
 */
export function Split({ parts, summary }: { parts: Part[]; summary: string }) {
  const total = parts.reduce((a, p) => a + p.value, 0);
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={summary} style={{ gap: 12 }}>
      <View style={styles.bar}>
        {total ? (
          parts.filter((p) => p.value > 0).map((p) => <View key={p.label} style={{ flex: p.value, backgroundColor: p.color }} />)
        ) : (
          <View style={{ flex: 1, backgroundColor: palette.rule }} />
        )}
      </View>
      <View>
        {parts.map((p) => (
          <View key={p.label} style={styles.row}>
            <View style={[styles.swatch, { backgroundColor: p.color }]} />
            <Text variant="caption" style={{ flex: 1 }}>
              {p.label}
            </Text>
            <Text style={styles.n}>{p.value.toLocaleString("en-IN")}</Text>
            <Text style={styles.share}>{total ? Math.round((p.value / total) * 100) : 0}%</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", height: 14, borderRadius: 3, overflow: "hidden", gap: 2 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: palette.rule },
  swatch: { width: 10, height: 10, borderRadius: 2 },
  n: { fontFamily: fonts.monoMedium, fontSize: 12.5, color: palette.ink, minWidth: 44, textAlign: "right" },
  share: { fontFamily: fonts.mono, fontSize: 11.5, color: palette.ink3, width: 40, textAlign: "right" },
});
