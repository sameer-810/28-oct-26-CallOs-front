import { ScrollView, StyleSheet, View } from "react-native";
import { fonts, palette } from "../designSystem";
import { Text } from "../ui/Text";

interface Props {
  days: string[];
  rows: { name: string; values: number[]; total: number }[];
  max: number;
  format?: (v: number) => string;
}

const STEPS = [0, 0.18, 0.36, 0.6, 0.85];

/** Ink intensity, five steps. Colour is for call state; this is just "how much". */
function shade(v: number, max: number) {
  if (!v || !max) return palette.card;
  const i = Math.min(STEPS.length - 1, Math.ceil((v / max) * (STEPS.length - 1)));
  return `rgba(23, 20, 15, ${STEPS[i]})`;
}

/** People down the side, days across, the month's busiest cells darkest. */
export function Heatmap({ days, rows, max, format = String }: Props) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator>
      <View>
        <View style={styles.row}>
          <View style={styles.name} />
          {days.map((d) => (
            <Text key={d} style={styles.dayHead}>
              {Number(d.slice(8))}
            </Text>
          ))}
          <Text style={[styles.dayHead, styles.total]}>Total</Text>
        </View>
        {rows.map((r) => (
          <View key={r.name} style={styles.row}>
            <Text style={styles.name} numberOfLines={1}>
              {r.name}
            </Text>
            {r.values.map((v, i) => (
              <View
                key={i}
                style={[styles.cell, { backgroundColor: shade(v, max) }]}
                accessibilityLabel={`${r.name}, ${days[i]}: ${format(v)}`}
              >
                {v && v / max > 0.6 ? <Text style={styles.cellText}>{format(v)}</Text> : null}
              </View>
            ))}
            <Text style={[styles.total, styles.totalValue]}>{format(r.total)}</Text>
          </View>
        ))}
        <View style={[styles.row, { marginTop: 10, gap: 4 }]}>
          <Text style={[styles.name, styles.legendText]}>Less</Text>
          {STEPS.map((s) => (
            <View key={s} style={[styles.cell, { backgroundColor: s ? `rgba(23,20,15,${s})` : palette.card }]} />
          ))}
          <Text style={[styles.legendText, { marginLeft: 6 }]}>More</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const CELL = 26;
const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 2, marginBottom: 2 },
  name: { width: 140, fontFamily: fonts.textMedium, fontSize: 12.5, color: palette.ink, paddingRight: 8 },
  dayHead: { width: CELL, textAlign: "center", fontFamily: fonts.mono, fontSize: 10, color: palette.ink3 },
  cell: {
    width: CELL,
    height: CELL,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: palette.rule,
    alignItems: "center",
    justifyContent: "center",
  },
  cellText: { fontFamily: fonts.monoMedium, fontSize: 9, color: palette.paper },
  total: { width: 64, textAlign: "right" },
  totalValue: { fontFamily: fonts.monoMedium, fontSize: 12, color: palette.ink },
  legendText: { fontFamily: fonts.mono, fontSize: 10.5, color: palette.ink3 },
});
