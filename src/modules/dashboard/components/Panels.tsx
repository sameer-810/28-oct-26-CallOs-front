import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { clock, dateTimeIn, formatPhone, num, talkTime } from "@shared/format";
import { fonts, palette, space } from "@shared/designSystem";
import { Card, Text, type PressState } from "@shared/ui";
import type { Call } from "@modules/calls/types";
import type { Summary } from "../types";
import { useNow } from "@shared/hooks/useNow";

export function Panel({ title, caption, children, action }: { title: string; caption?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <Card padded={false}>
      <View style={styles.panelHead}>
        <View style={{ flex: 1 }}>
          <Text variant="heading">{title}</Text>
          {caption ? (
            <Text variant="caption" tone="tertiary">
              {caption}
            </Text>
          ) : null}
        </View>
        {action}
      </View>
      <View style={styles.panelBody}>{children}</View>
    </Card>
  );
}

/** Ranked by connected calls, then talk time: who actually spoke to clients. */
export function Leaderboard({ rows }: { rows: Summary["leaderboard"] }) {
  const best = Math.max(1, ...rows.map((r) => r.connected));
  if (!rows.length) {
    return (
      <Text variant="caption" tone="tertiary">
        Nobody has made a call in this period yet.
      </Text>
    );
  }
  return (
    <View>
      <View style={[styles.lbRow, styles.lbHead]}>
        <Text style={[styles.lbRank, styles.th]}>#</Text>
        <Text style={[styles.th, { flex: 1 }]}>Rep</Text>
        <Text style={[styles.th, styles.lbNum]}>Connected</Text>
        <Text style={[styles.th, styles.lbNum]}>Talk</Text>
      </View>
      {rows.slice(0, 8).map((r) => (
        <View key={r.userId} style={styles.lbRow}>
          <Text style={[styles.lbRank, r.rank === 1 && styles.first]}>{r.rank}</Text>
          <View style={{ flex: 1, gap: 4 }}>
            <Text variant="bodyMedium" numberOfLines={1}>
              {r.name}
            </Text>
            <View style={styles.meter}>
              <View style={[styles.meterFill, { width: `${(r.connected / best) * 100}%` }]} />
            </View>
          </View>
          <Text style={styles.lbNum}>
            {num(r.connected)}
            <Text style={styles.of}>/{num(r.total)}</Text>
          </Text>
          <Text style={styles.lbNum}>{talkTime(r.talkSec)}</Text>
        </View>
      ))}
    </View>
  );
}

export function FollowUps({ items, counts, tz, onOpen }: { items: Call[]; counts: { overdue: number; today: number }; tz: string; onOpen: () => void }) {
  const now = useNow();
  return (
    <View style={{ gap: space.sm }}>
      <View style={styles.fuCounts}>
        <View style={styles.fuCount}>
          <Text style={[styles.fuN, counts.overdue > 0 && { color: palette.missed }]}>{counts.overdue}</Text>
          <Text variant="caption" tone="tertiary">
            overdue
          </Text>
        </View>
        <View style={styles.fuCount}>
          <Text style={styles.fuN}>{counts.today}</Text>
          <Text variant="caption" tone="tertiary">
            due today
          </Text>
        </View>
      </View>
      {items.slice(0, 5).map((c) => {
        const late = c.followUpAt && new Date(c.followUpAt).getTime() < now;
        return (
          <Pressable key={c.id} onPress={onOpen} style={({ hovered }: PressState) => [styles.fuRow, hovered && { backgroundColor: palette.paper }]}>
            <View style={{ flex: 1 }}>
              <Text variant="bodyMedium" numberOfLines={1}>
                {c.contactName || formatPhone(c.phone)}
              </Text>
              <Text variant="caption" tone="tertiary" numberOfLines={1}>
                {c.employee ?? ""}
                {c.notes ? ` · ${c.notes}` : ""}
              </Text>
            </View>
            <Text style={[styles.fuWhen, late && { color: palette.missed }]}>{c.followUpAt ? dateTimeIn(c.followUpAt, tz) : ""}</Text>
          </Pressable>
        );
      })}
      {!items.length ? (
        <Text variant="caption" tone="tertiary">
          No promised call-backs. They appear here when a rep sets a follow-up after a call.
        </Text>
      ) : null}
    </View>
  );
}

export function Opportunities({ o, onOpen }: { o: Summary["opportunities"]; onOpen: () => void }) {
  return (
    <View style={{ gap: space.md }}>
      <View style={styles.oppRow}>
        {[
          ["2+ talks", o.connects2],
          ["3+ talks", o.connects3],
          ["5+ talks", o.connects5],
        ].map(([label, n]) => (
          <View key={label as string} style={styles.oppCell}>
            <Text style={styles.oppN}>{num(n as number)}</Text>
            <Text variant="caption" tone="tertiary">
              {label}
            </Text>
          </View>
        ))}
        <View style={styles.oppCell}>
          <Text style={styles.oppN}>{clock(o.avgTalkSec)}</Text>
          <Text variant="caption" tone="tertiary">
            avg talk
          </Text>
        </View>
      </View>
      <Text variant="label" tone="secondary">
        Hot leads
      </Text>
      {o.hotLeads.length ? (
        o.hotLeads.slice(0, 5).map((h) => (
          <Pressable key={h.phone} onPress={onOpen} style={({ hovered }: PressState) => [styles.hotRow, hovered && { backgroundColor: palette.paper }]}>
            <View style={styles.hotDot} />
            <View style={{ flex: 1 }}>
              <Text variant="bodyMedium" numberOfLines={1}>
                {h.name || formatPhone(h.phone)}
              </Text>
              <Text variant="caption" tone="tertiary" numberOfLines={1}>
                {h.employee} · {h.connects} talk{h.connects === 1 ? "" : "s"} · {talkTime(h.talkSec)}
              </Text>
            </View>
          </Pressable>
        ))
      ) : (
        <Text variant="caption" tone="tertiary">
          A client shows up here when their latest call is marked Hot.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panelHead: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingTop: space.md + 2,
    paddingBottom: space.md,
    borderBottomWidth: 1,
    borderBottomColor: palette.rule,
  },
  panelBody: { padding: space.lg },
  th: { fontFamily: fonts.mono, fontSize: 10.5, color: palette.ink3, textTransform: "uppercase", letterSpacing: 0.5 },
  lbHead: { paddingBottom: 6 },
  lbRow: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: palette.rule },
  lbRank: { width: 18, fontFamily: fonts.mono, fontSize: 12, color: palette.ink3 },
  first: { color: palette.ink, fontFamily: fonts.monoMedium },
  lbNum: { width: 92, textAlign: "right", fontFamily: fonts.monoMedium, fontSize: 13, color: palette.ink },
  of: { fontFamily: fonts.mono, fontSize: 11, color: palette.ink3 },
  meter: { height: 3, backgroundColor: palette.rule, borderRadius: 2, overflow: "hidden" },
  meterFill: { height: 3, backgroundColor: palette.ink },
  fuCounts: { flexDirection: "row", gap: space.xl, marginBottom: space.xs },
  fuCount: { gap: 0 },
  fuN: { fontFamily: fonts.display, fontSize: 34, lineHeight: 38, color: palette.ink },
  fuRow: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: 8, borderTopWidth: 1, borderTopColor: palette.rule },
  fuWhen: { fontFamily: fonts.mono, fontSize: 11, color: palette.ink2 },
  oppRow: { flexDirection: "row", borderWidth: 1, borderColor: palette.rule, borderRadius: 6 },
  oppCell: { flex: 1, paddingVertical: space.sm + 2, alignItems: "center", borderRightWidth: 1, borderRightColor: palette.rule },
  oppN: { fontFamily: fonts.monoMedium, fontSize: 18, color: palette.ink },
  hotRow: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: 7, borderTopWidth: 1, borderTopColor: palette.rule },
  hotDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#B3261E" },
});
