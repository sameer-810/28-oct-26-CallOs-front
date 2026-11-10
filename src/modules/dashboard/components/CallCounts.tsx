import { StyleSheet, View } from "react-native";
import { num, talkTime } from "@shared/format";
import { palette, radius, space } from "@shared/designSystem";
import { Text } from "@shared/ui";
import { CallGlyph } from "@shared/ui/CallGlyph";
import type { Totals } from "../types";

type Glyph = "incoming" | "outgoing" | "missed" | "rejected" | "blocked";

interface Count {
  label: string;
  value: number;
  /** Talk time under the number, where there is any to speak of. */
  talkSec?: number;
  glyph?: Glyph;
  tone?: "missed" | "connected";
}

/**
 * Every count the phone's own call log can tell you, two to a row — the
 * callos phone dashboard's grid, so a rep reads their day the way they're
 * used to. Talk time sits under the counts that have any.
 */
export function CallCounts({ t }: { t: Totals }) {
  const counts: Count[] = [
    { label: "Total calls", value: t.total, talkSec: t.talkSec },
    { label: "Connected calls", value: t.connected, talkSec: t.talkSec, tone: "connected" },
    { label: "Incoming", value: t.incoming, talkSec: t.incomingTalkSec, glyph: "incoming" },
    { label: "Outgoing", value: t.outgoing, talkSec: t.outgoingTalkSec, glyph: "outgoing" },
    { label: "Missed", value: t.missed, glyph: "missed", tone: "missed" },
    { label: "Rejected", value: t.rejected, glyph: "rejected", tone: "missed" },
    { label: "Blocked", value: t.blocked, glyph: "blocked" },
    { label: "Never attended", value: t.neverAttended, glyph: "missed", tone: "missed" },
    { label: "Not picked up by client", value: t.notPickedUp, glyph: "outgoing" },
    { label: "Unique clients", value: t.uniqueClients },
  ];
  return (
    <View style={styles.grid} accessibilityRole="summary">
      {counts.map((c) => (
        <View key={c.label} style={styles.cell}>
          <View style={styles.card}>
            <View style={styles.top}>
              {c.glyph ? <CallGlyph type={c.glyph} size={14} /> : null}
              <Text variant="label" tone="secondary" numberOfLines={2} style={{ flex: 1 }}>
                {c.label}
              </Text>
            </View>
            <Text
              variant="title"
              style={[styles.value, c.tone === "missed" && c.value > 0 ? { color: palette.missed } : null]}
            >
              {num(c.value)}
            </Text>
            {c.talkSec !== undefined ? (
              <Text variant="mono" tone="tertiary">
                {c.talkSec ? talkTime(c.talkSec) : "0 sec"}
              </Text>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -space.xs },
  cell: { width: "50%", padding: space.xs },
  card: {
    minHeight: 104,
    padding: space.md,
    gap: space.xs,
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.rule,
    borderRadius: radius.lg,
  },
  top: { flexDirection: "row", alignItems: "center", gap: space.xs },
  value: { marginTop: space.xs },
});
