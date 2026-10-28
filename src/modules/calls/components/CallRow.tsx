import { Pressable, StyleSheet, View } from "react-native";
import { clock, formatPhone, timeIn } from "@shared/format";
import { fonts, palette, space } from "@shared/designSystem";
import { Text, TONE_COLOR, type PressState } from "@shared/ui";
import { CallGlyph } from "@shared/ui/CallGlyph";
import { useNow } from "@shared/hooks/useNow";
import type { Disposition } from "@modules/auth/types";
import { TYPE_LABEL, isConnected, type Call } from "../types";

interface Props {
  call: Call;
  tz: string;
  showEmployee: boolean;
  dispositions: Disposition[];
  isWide: boolean;
  onPress: () => void;
}

/** A call log line: who, which way, when, how long, and what the rep made of it. */
export function CallRow({ call: c, tz, showEmployee, dispositions, isWide, onPress }: Props) {
  const who = c.contactName || formatPhone(c.phone);
  const missed = c.type === "missed" || c.type === "rejected";
  const tone = dispositions.find((d) => d.key === c.leadStatus)?.tone;
  const now = useNow();
  const overdue = c.followUpAt && !c.followUpDone && new Date(c.followUpAt).getTime() < now;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${TYPE_LABEL[c.type]} call, ${who}, ${timeIn(c.startedAt, tz)}, ${isConnected(c) ? clock(c.durationSec) : "not connected"}${c.leadStatusLabel ? `, ${c.leadStatusLabel}` : ""}. Open`}
      style={({ hovered }: PressState) => [styles.row, hovered && styles.hover]}
    >
      <View style={styles.glyph}>
        <CallGlyph type={c.type} />
      </View>

      <View style={styles.who}>
        <Text variant="bodyMedium" numberOfLines={1} style={missed && { color: palette.missed }}>
          {who}
        </Text>
        <Text variant="mono" tone="tertiary" numberOfLines={1} style={styles.sub}>
          {c.contactName ? formatPhone(c.phone) : TYPE_LABEL[c.type]}
          {c.source === "whatsapp" ? "  · WhatsApp" : ""}
          {showEmployee && c.employee && !isWide ? `  · ${c.employee}` : ""}
        </Text>
      </View>

      {isWide && showEmployee ? (
        <Text variant="caption" tone="secondary" numberOfLines={1} style={styles.emp}>
          {c.employee}
        </Text>
      ) : null}

      <View style={[styles.status, !isWide && styles.statusNarrow]}>
        {c.leadStatusLabel ? (
          <View style={styles.pill}>
            <View style={[styles.dot, { backgroundColor: TONE_COLOR[tone ?? "neutral"] }]} />
            <Text style={styles.pillText} numberOfLines={1}>
              {c.leadStatusLabel}
            </Text>
          </View>
        ) : null}
        {overdue ? <Text style={styles.overdue}>Follow-up due</Text> : null}
        {c.score !== null ? (
          <View style={[styles.score, c.score < 40 && styles.scoreLow]} accessibilityLabel={`AI score ${c.score} out of 100`}>
            <Text style={[styles.scoreText, c.score < 40 && { color: palette.missed }]}>{c.score}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.right}>
        <Text style={styles.time}>{timeIn(c.startedAt, tz)}</Text>
        <Text style={[styles.dur, !isConnected(c) && styles.durOff]}>{isConnected(c) ? clock(c.durationSec) : "—"}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: palette.rule,
    flexWrap: "wrap",
  },
  hover: { backgroundColor: palette.paper },
  glyph: { width: 18, alignItems: "center" },
  who: { flex: 1, minWidth: 140, gap: 1 },
  sub: { fontSize: 11.5 },
  emp: { width: 140 },
  status: { width: 150, gap: 6, flexDirection: "row", flexWrap: "wrap", alignItems: "center" },
  statusNarrow: { width: "auto", order: 10, marginLeft: 30 } as object,
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.rule,
    backgroundColor: palette.paper,
    maxWidth: 150,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { fontFamily: fonts.textMedium, fontSize: 11.5, color: palette.ink },
  score: { flexDirection: "row", alignItems: "center", paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, borderWidth: 1, borderColor: palette.ink },
  scoreLow: { borderColor: palette.missed },
  scoreText: { fontFamily: fonts.monoMedium, fontSize: 10.5, color: palette.ink },
  overdue: { fontFamily: fonts.monoMedium, fontSize: 10.5, color: palette.missed },
  right: { alignItems: "flex-end", minWidth: 56 },
  time: { fontFamily: fonts.mono, fontSize: 11.5, color: palette.ink3 },
  dur: { fontFamily: fonts.monoMedium, fontSize: 13, color: palette.ink },
  durOff: { color: palette.ink3 },
});
