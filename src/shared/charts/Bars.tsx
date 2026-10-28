import { StyleSheet, View } from "react-native";
import { fonts, palette } from "../designSystem";
import { Text } from "../ui/Text";

export interface Bar {
  label: string;
  value: number;
  /** A second, overlaid value drawn darker — connected within total. */
  inner?: number;
}

interface Props {
  data: Bar[];
  height?: number;
  /** Show every n-th x label so they never collide. */
  labelEvery?: number;
  format?: (v: number) => string;
  /** Accessible summary: what the chart says, in one sentence. */
  summary: string;
}

/**
 * Columns drawn with views: total in rule grey, the inner value in ink, the
 * peak labelled. No axis furniture — the labels are the scale.
 */
export function Bars({ data, height = 180, labelEvery = 1, format = String, summary }: Props) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const peak = data.reduce((best, d, i) => (d.value > data[best].value ? i : best), 0);
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={summary}>
      <View style={[styles.plot, { height }]}>
        {data.map((d, i) => (
          <View key={i} style={styles.col}>
            {i === peak && d.value > 0 ? <Text style={styles.peak}>{format(d.value)}</Text> : null}
            <View style={[styles.bar, { height: `${(d.value / max) * 100}%` }]}>
              {d.inner ? <View style={[styles.inner, { height: `${(d.inner / Math.max(1, d.value)) * 100}%` }]} /> : null}
            </View>
          </View>
        ))}
      </View>
      <View style={styles.axis}>
        {data.map((d, i) => (
          <Text key={i} style={styles.x} numberOfLines={1}>
            {i % labelEvery === 0 ? d.label : ""}
          </Text>
        ))}
      </View>
    </View>
  );
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <View style={styles.legend}>
      {items.map((it) => (
        <View key={it.label} style={styles.legendItem}>
          <View style={[styles.swatch, { backgroundColor: it.color }]} />
          <Text variant="caption" tone="secondary">
            {it.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  plot: { flexDirection: "row", alignItems: "flex-end", gap: 3, borderBottomWidth: 1, borderBottomColor: palette.ink, paddingTop: 18 },
  col: { flex: 1, height: "100%", justifyContent: "flex-end", alignItems: "stretch" },
  bar: { backgroundColor: palette.ruleStrong, borderTopLeftRadius: 2, borderTopRightRadius: 2, justifyContent: "flex-end", overflow: "hidden", minHeight: 0 },
  inner: { backgroundColor: palette.ink },
  peak: { fontFamily: fonts.monoMedium, fontSize: 10.5, color: palette.ink, textAlign: "center", marginBottom: 3 },
  axis: { flexDirection: "row", gap: 3, marginTop: 6 },
  x: { flex: 1, fontFamily: fonts.mono, fontSize: 10, color: palette.ink3, textAlign: "center" },
  legend: { flexDirection: "row", gap: 16, flexWrap: "wrap" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  swatch: { width: 10, height: 10, borderRadius: 2 },
});
