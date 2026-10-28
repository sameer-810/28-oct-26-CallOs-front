import { StyleSheet, View } from "react-native";
import { initials, num, pct, talkTime } from "@shared/format";
import { fonts, palette, space } from "@shared/designSystem";
import { Text } from "@shared/ui";
import type { GlancePeriod, Pipeline, Summary, TopSalesperson } from "../types";

/** One person, the reason they're on top, and how far ahead. */
export function TopSalespersonCard({ top }: { top: TopSalesperson | null }) {
  if (!top) {
    return (
      <Text variant="caption" tone="tertiary">
        Nobody has connected a call this week yet. The first rep to do it takes the spot.
      </Text>
    );
  }
  return (
    <View style={styles.top} accessible accessibilityLabel={`${top.name}: ${top.connected} connected of ${top.calls} calls, ${talkTime(top.talkSec)} talk time this week`}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials(top.name)}</Text>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="heading" numberOfLines={1}>
          {top.name}
        </Text>
        <Text variant="caption" tone="secondary">
          {num(top.connected)} connected of {num(top.calls)} · {talkTime(top.talkSec)} talking
        </Text>
      </View>
      <Text style={styles.rate}>{pct(top.connected, top.calls)}%</Text>
    </View>
  );
}

/** The month's deals as one bar: closed in ink, still open in grey, reopened marked. */
export function PipelineCard({ p }: { p: Pipeline }) {
  const total = p.open + p.openAgain + p.closed;
  const parts = [
    { label: "Closed", value: p.closed, color: palette.connected },
    { label: "Open again", value: p.openAgain, color: palette.marker },
    { label: "Open", value: p.open, color: palette.ruleStrong },
  ];
  return (
    <View style={{ gap: space.md }}>
      <View
        style={styles.bar}
        accessible
        accessibilityRole="image"
        accessibilityLabel={`${p.closed} closed, ${p.openAgain} open again, ${p.open} open, ${p.newClients} new clients this month`}
      >
        {total ? parts.filter((x) => x.value).map((x) => <View key={x.label} style={{ flex: x.value, backgroundColor: x.color }} />) : <View style={{ flex: 1, backgroundColor: palette.rule }} />}
      </View>
      <View style={styles.legend}>
        {parts.map((x) => (
          <View key={x.label} style={styles.legendItem}>
            <View style={[styles.swatch, { backgroundColor: x.color }]} />
            <Text variant="caption" tone="secondary">
              {x.label}
            </Text>
            <Text style={styles.legendNum}>{num(x.value)}</Text>
          </View>
        ))}
        <View style={styles.legendItem}>
          <Text variant="caption" tone="secondary">
            New clients
          </Text>
          <Text style={styles.legendNum}>{num(p.newClients)}</Text>
        </View>
      </View>
      {total ? (
        <Text variant="caption" tone="tertiary">
          {pct(p.closed, total)}% of this month’s deals are closed.
        </Text>
      ) : null}
    </View>
  );
}

const PERIOD_LABEL: Record<GlancePeriod, string> = { today: "Today", yesterday: "Yesterday", last_week: "Last week" };
const ROWS: { label: string; get: (t: Summary["totals"]) => string }[] = [
  { label: "Calls", get: (t) => num(t.total) },
  { label: "Connected", get: (t) => num(t.connected) },
  { label: "Talk time", get: (t) => talkTime(t.talkSec) },
  { label: "Missed / rejected", get: (t) => num(t.missed + t.rejected) },
  { label: "Unique clients", get: (t) => num(t.uniqueClients) },
  { label: "Not called back", get: (t) => num(t.neverAttended) },
];

/** Three periods in three columns, read across: the morning check without touching a filter. */
export function Glance({ periods }: { periods: { period: GlancePeriod; totals: Summary["totals"] | undefined }[] }) {
  return (
    <View role="group" aria-label="At a glance: today, yesterday and last week">
      <View style={[styles.gRow, styles.gHead]}>
        <Text style={[styles.gLabel, styles.th]} />
        {periods.map((p) => (
          <Text key={p.period} style={[styles.gCell, styles.th]}>
            {PERIOD_LABEL[p.period]}
          </Text>
        ))}
      </View>
      {ROWS.map((r) => (
        <View key={r.label} style={styles.gRow}>
          <Text style={styles.gLabel} numberOfLines={1}>
            {r.label}
          </Text>
          {periods.map((p) => (
            <Text key={p.period} style={[styles.gCell, styles.gNum]}>
              {p.totals ? r.get(p.totals) : "…"}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "center", gap: space.md },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: palette.marker, alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: fonts.textSemi, fontSize: 15, color: palette.ink },
  rate: { fontFamily: fonts.display, fontSize: 30, color: palette.ink },
  bar: { flexDirection: "row", height: 14, borderRadius: 3, overflow: "hidden", gap: 2 },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: space.lg },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  swatch: { width: 10, height: 10, borderRadius: 2 },
  legendNum: { fontFamily: fonts.monoMedium, fontSize: 13, color: palette.ink },
  gRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: palette.rule },
  gHead: { borderBottomColor: palette.ink },
  gLabel: { flex: 1.4, fontFamily: fonts.text, fontSize: 13.5, color: palette.ink2 },
  gCell: { flex: 1, textAlign: "right" },
  gNum: { fontFamily: fonts.mono, fontSize: 13.5, color: palette.ink },
  th: { fontFamily: fonts.mono, fontSize: 10.5, color: palette.ink3, textTransform: "uppercase", letterSpacing: 0.4 },
});
