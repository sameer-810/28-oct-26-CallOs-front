import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { clock, dateTimeIn } from "@shared/format";
import { fonts, palette, radius, space } from "@shared/designSystem";
import { Button, Chip, Tag, Text, type PressState } from "@shared/ui";
import type { Disposition } from "@modules/auth/types";
import type { CallDetail } from "../types";

const RUBRIC_LABEL: Record<string, string> = {
  opening: "Opening",
  discovery: "Discovery",
  objectionHandling: "Objections",
  nextStep: "Next step",
  tone: "Tone",
};

const SENTIMENT: Record<string, string> = { positive: "Client positive", neutral: "Client neutral", negative: "Client negative" };

/** 0–100 as a word a manager can act on. */
export function scoreBand(score: number) {
  return score >= 75 ? "Strong call" : score >= 55 ? "Decent call" : score >= 35 ? "Needs work" : "Poor call";
}

interface Props {
  call: CallDetail;
  tz: string;
  dispositions: Disposition[];
  repName: string;
  onSeek: (sec: number) => void;
  onAcceptStatus: (key: string) => void;
  onTranscribe?: () => void;
  transcribing?: boolean;
}

/**
 * What the AI made of the call. Everything is anchored to the recording: a
 * timestamp seeks the player, so a manager can hear the moment it describes
 * instead of taking the summary on trust.
 */
export function InsightsPanel({ call, tz, dispositions, repName, onSeek, onAcceptStatus, onTranscribe, transcribing }: Props) {
  const [showAll, setShowAll] = useState(false);
  const t = call.transcript;
  const i = call.insights;

  if (t.status === "queued" || t.status === "processing") {
    return (
      <View style={styles.box}>
        <Text variant="label">AI review</Text>
        <Text variant="caption" tone="secondary">
          Transcribing and reading the call… usually under a minute.
        </Text>
      </View>
    );
  }
  if (!i || t.status !== "done") {
    if (call.recording.status !== "uploaded") return null;
    return (
      <View style={styles.box}>
        <Text variant="label">AI review</Text>
        <Text variant="caption" tone="secondary">
          {t.status === "failed"
            ? `It didn’t work this time: ${t.error ?? "unknown error"}.`
            : t.status === "skipped"
              ? "No speech was found in the recording."
              : "This call hasn’t been transcribed."}
        </Text>
        {onTranscribe ? <Button kind="ghost" size="sm" label="Transcribe this call" loading={transcribing} onPress={onTranscribe} /> : null}
      </View>
    );
  }

  const suggested = i.suggestedStatus ? dispositions.find((d) => d.key === i.suggestedStatus) : undefined;
  const lines = showAll ? t.lines : t.lines.slice(0, 6);

  return (
    <View style={{ gap: space.lg }}>
      <View style={styles.scoreRow}>
        <View style={styles.scoreBox}>
          <Text style={styles.score}>{i.score}</Text>
          <Text style={styles.of}>/100</Text>
        </View>
        <View style={{ flex: 1, gap: 6 }}>
          <View style={styles.inline}>
            <Text variant="heading">{scoreBand(i.score)}</Text>
            {i.model === "demo" ? <Tag label="Sample analysis" tone="dashed" /> : null}
          </View>
          <Text variant="caption" tone="tertiary">
            {SENTIMENT[i.sentiment]} · {t.language ? `${t.language.toUpperCase()} · ` : ""}reviewed by AI
          </Text>
          <View style={styles.rubric}>
            {Object.entries(i.rubric).map(([k, v]) => (
              <View key={k} style={styles.rubricRow} accessible accessibilityLabel={`${RUBRIC_LABEL[k]} ${v} out of 20`}>
                <Text style={styles.rubricLabel}>{RUBRIC_LABEL[k]}</Text>
                <View style={styles.bar}>
                  <View style={[styles.barFill, { width: `${(v / 20) * 100}%` }, v < 8 && { backgroundColor: palette.missed }]} />
                </View>
                <Text style={styles.rubricN}>{v}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      <View style={styles.block}>
        <Text variant="label">Summary</Text>
        <Text>{i.summary}</Text>
        {i.nextStep ? (
          <Text variant="caption" tone="secondary">
            <Text variant="label">Next step: </Text>
            {i.nextStep}
          </Text>
        ) : null}
      </View>

      {suggested && call.leadStatus !== suggested.key ? (
        <View style={styles.suggest}>
          <Text variant="caption" style={{ flex: 1 }}>
            The AI would mark this <Text variant="label">{suggested.label}</Text>.
          </Text>
          <Chip label={`Mark ${suggested.label}`} tone={suggested.tone} onPress={() => onAcceptStatus(suggested.key)} />
        </View>
      ) : null}

      {i.objections.length ? (
        <View style={styles.block}>
          <Text variant="label">Objections</Text>
          {i.objections.map((o, n) => (
            <Pressable key={n} onPress={() => onSeek(o.at)} accessibilityRole="button" accessibilityLabel={`Play from ${clock(o.at)}: ${o.quote}`} style={({ hovered }: PressState) => [styles.obj, hovered && styles.hover]}>
              <Text style={styles.at}>{clock(o.at)}</Text>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.quote}>“{o.quote}”</Text>
                <Text variant="caption" tone={o.handled ? "connected" : "missed"}>
                  {o.topic} · {o.handled ? "answered" : "left unanswered"}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}

      {i.promises.length ? (
        <View style={styles.block}>
          <Text variant="label">Promised on the call</Text>
          {i.promises.map((p, n) => (
            <View key={n} style={styles.promise}>
              <Tag label={p.by === "rep" ? repName.split(" ")[0] : "Client"} tone={p.by === "rep" ? "ink" : "neutral"} />
              <Text style={{ flex: 1 }}>{p.what}</Text>
              {p.dueAt ? <Text style={styles.due}>{dateTimeIn(p.dueAt, tz)}</Text> : null}
            </View>
          ))}
          {call.followUpSource === "ai" && call.followUpAt ? (
            <Text variant="caption" tone="tertiary">
              Added to follow-ups for {dateTimeIn(call.followUpAt, tz)}.
            </Text>
          ) : null}
        </View>
      ) : null}

      {i.coaching.length ? (
        <View style={[styles.block, styles.coach]}>
          <Text variant="label">For next time</Text>
          {i.coaching.map((c, n) => (
            <Text key={n} variant="caption" style={{ color: palette.ink }}>
              {n + 1}. {c}
            </Text>
          ))}
        </View>
      ) : null}

      <View style={styles.block}>
        <Text variant="label">Transcript</Text>
        {lines.map((l, n) => (
          <Pressable key={n} onPress={() => onSeek(l.start)} accessibilityRole="button" accessibilityLabel={`Play from ${clock(l.start)}`} style={({ hovered }: PressState) => [styles.line, hovered && styles.hover]}>
            <Text style={styles.at}>{clock(l.start)}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.who, l.who === "rep" && { color: palette.ink }]}>{l.who === "rep" ? repName.split(" ")[0] : "Client"}</Text>
              <Text style={styles.text}>{l.text}</Text>
            </View>
          </Pressable>
        ))}
        {t.lines.length > 6 ? (
          <Button kind="quiet" size="sm" label={showAll ? "Show less" : `Show all ${t.lines.length} lines`} onPress={() => setShowAll((s) => !s)} />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { padding: space.md, borderRadius: radius.md, backgroundColor: palette.paper, gap: space.sm },
  scoreRow: { flexDirection: "row", gap: space.lg, alignItems: "flex-start" },
  scoreBox: { width: 88, height: 88, borderRadius: 44, borderWidth: 2, borderColor: palette.ink, alignItems: "center", justifyContent: "center", flexDirection: "row" },
  score: { fontFamily: fonts.display, fontSize: 36, lineHeight: 40, color: palette.ink },
  of: { fontFamily: fonts.mono, fontSize: 10, color: palette.ink3, marginTop: 14 },
  inline: { flexDirection: "row", alignItems: "center", gap: space.sm, flexWrap: "wrap" },
  rubric: { gap: 5, marginTop: 4 },
  rubricRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  rubricLabel: { width: 74, fontFamily: fonts.text, fontSize: 11.5, color: palette.ink2 },
  bar: { flex: 1, height: 5, borderRadius: 3, backgroundColor: palette.rule, overflow: "hidden" },
  barFill: { height: 5, backgroundColor: palette.ink },
  rubricN: { width: 20, textAlign: "right", fontFamily: fonts.monoMedium, fontSize: 11, color: palette.ink },
  block: { gap: space.sm },
  suggest: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md, borderRadius: radius.md, backgroundColor: palette.markerSoft },
  obj: { flexDirection: "row", gap: space.md, paddingVertical: 6, paddingHorizontal: 4, borderRadius: 4 },
  hover: { backgroundColor: palette.paper },
  at: { width: 40, fontFamily: fonts.mono, fontSize: 11, color: palette.ink3, paddingTop: 2 },
  quote: { fontFamily: fonts.display, fontSize: 16, lineHeight: 21, color: palette.ink },
  promise: { flexDirection: "row", alignItems: "center", gap: space.sm },
  due: { fontFamily: fonts.mono, fontSize: 11, color: palette.ink2 },
  coach: { padding: space.md, borderLeftWidth: 3, borderLeftColor: palette.marker, backgroundColor: palette.paper, borderRadius: 4 },
  line: { flexDirection: "row", gap: space.md, paddingVertical: 5, paddingHorizontal: 4, borderRadius: 4 },
  who: { fontFamily: fonts.textSemi, fontSize: 11, color: palette.ink3 },
  text: { fontFamily: fonts.text, fontSize: 14, lineHeight: 20, color: palette.ink },
});
