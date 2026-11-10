import { StyleSheet, View } from "react-native";
import { clock, formatPhone } from "@shared/format";
import { palette, radius, space } from "@shared/designSystem";
import { Icon, Text, type IconName } from "@shared/ui";
import type { Personal } from "../types";

function Card({ icon, label, value, sub }: { icon: IconName; label: string; value: string; sub?: string }) {
  return (
    <View style={styles.cell}>
      <View style={styles.card}>
        <View style={styles.tile}>
          <Icon name={icon} size={18} />
        </View>
        <Text variant="label" tone="secondary">
          {label}
        </Text>
        <Text variant="heading" numberOfLines={1}>
          {value}
        </Text>
        {sub ? (
          <Text variant="caption" tone="tertiary" numberOfLines={1}>
            {sub}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/** The callos phone's Analytics tab, four cards: who you called most, your longest call, your averages. */
export function PersonalCards({ p }: { p: Personal }) {
  const top = p.topCaller;
  const long = p.longestCall;
  return (
    <View style={styles.grid}>
      <Card
        icon="account"
        label="Top caller"
        value={top ? top.name || formatPhone(top.phone) : "—"}
        sub={top ? `${top.name ? `${formatPhone(top.phone)} · ` : ""}${top.calls} call${top.calls === 1 ? "" : "s"}` : "No calls yet"}
      />
      <Card
        icon="clock"
        label="Longest call"
        value={long ? clock(long.durationSec) : "—"}
        sub={long ? long.name || formatPhone(long.phone) : "No connected calls yet"}
      />
      <Card icon="sync" label="Average duration" value={clock(p.avgDurationSec)} sub="per call" />
      <Card icon="chart" label="Daily average calls" value={String(p.dailyAvgCalls)} sub="calls a day" />
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -space.xs },
  cell: { width: "50%", padding: space.xs },
  card: {
    padding: space.md,
    gap: 4,
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.rule,
    borderRadius: radius.lg,
  },
  tile: { width: 32, height: 32, borderRadius: radius.md, backgroundColor: palette.paper, alignItems: "center", justifyContent: "center", marginBottom: 2 },
});
