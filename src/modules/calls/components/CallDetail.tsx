import { useRef, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { apiErrorMessage } from "@api/apiClient";
import { useAuthStore } from "@shared/store/useAuthStore";
import { clock, dateTimeIn, formatPhone } from "@shared/format";
import { fonts, palette, radius, space } from "@shared/designSystem";
import { Banner, Button, Chip, Rule, Sheet, Text } from "@shared/ui";
import { CallGlyph } from "@shared/ui/CallGlyph";
import { DEAL_LABEL, TYPE_LABEL, isConnected, type Call, type CallDetail as Detail, SOURCE_LABEL } from "../types";
import { InsightsPanel } from "./InsightsPanel";
import { useCallStore } from "@modules/telephony/useCallStore";
import { useCanCall } from "@modules/telephony/hooks/useTelephony";
import { useCall, useTranscribe, useUpdateCall } from "../hooks/useCalls";
import { RecordingPlayer } from "./RecordingPlayer";
import { useNow } from "@shared/hooks/useNow";
import { ReviewPanel } from "@modules/coaching/components/ReviewPanel";
import { useComments } from "@modules/coaching/hooks/useComments";
import { WhatsAppComposer } from "@modules/playbook/components/WhatsAppComposer";

/** Follow-up presets on the device's clock — the rep's own day — as reps actually promise them. */
function presets(now = new Date()) {
  const at = (days: number, h: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() + days);
    d.setHours(h, 0, 0, 0);
    return d;
  };
  const toMonday = ((8 - now.getDay()) % 7) || 7;
  return [
    ...(now.getHours() < 17 ? [{ label: "Later today, 6 pm", at: at(0, 18) }] : []),
    { label: "Tomorrow, 11 am", at: at(1, 11) },
    { label: "In 2 days", at: at(2, 11) },
    { label: "Next Monday", at: at(toMonday, 11) },
    { label: "In a week", at: at(7, 11) },
  ];
}

function Fact({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={styles.fact}>
      <Text variant="caption" tone="tertiary">
        {label}
      </Text>
      <Text variant={mono ? "mono" : "body"} style={mono && { fontSize: 14 }}>
        {value || "—"}
      </Text>
    </View>
  );
}

export function CallDetail({
  call,
  onClose,
  onShowClient,
  startAt = null,
  focusCommentId = null,
}: {
  call: Call;
  onClose: () => void;
  onShowClient: (phone: string) => void;
  /** Opened from a notification: start the recording here. */
  startAt?: number | null;
  focusCommentId?: string | null;
}) {
  const company = useAuthStore((s) => s.company);
  const update = useUpdateCall();
  const canCall = useCanCall();
  const dial = useCallStore((s) => s.call);
  const [notes, setNotes] = useState(call.notes);
  const [seek, setSeek] = useState<{ sec: number; n: number } | null>(startAt !== null ? { sec: startAt, n: 1 } : null);
  const positionRef = useRef(0);
  const me = useAuthStore((s) => s.user?.id);
  const comments = useComments(call.id);
  const tz = company?.timezone ?? "Asia/Kolkata";
  const now = useNow();

  const detail = useCall(call.id);
  const current: Detail = detail.data ?? {
    ...call,
    transcript: { status: call.transcriptStatus, language: "", lines: [], error: null },
    insights: null,
  };
  const transcribe = useTranscribe(call.id);

  const save = (patch: Parameters<typeof update.mutate>[0]["patch"]) =>
    update.mutate(
      { id: call.id, patch },
      {
        onSuccess: (c) => setNotes(c.notes),
      },
    );

  const who = current.contactName || formatPhone(current.phone);
  const fu = current.followUpAt ? new Date(current.followUpAt) : null;

  return (
    <Sheet visible onClose={onClose} title={who}>
      <View style={styles.typeLine}>
        <CallGlyph type={current.type} size={18} />
        <Text variant="bodyMedium">{TYPE_LABEL[current.type]}</Text>
        <Text tone="tertiary">·</Text>
        <Text tone="secondary">{dateTimeIn(current.startedAt, tz)}</Text>
      </View>

      {canCall ? (
        <Button label={`Call ${current.contactName || formatPhone(current.phone)}`} onPress={() => dial(current.phone, current.contactName)} />
      ) : null}

      <View style={styles.facts}>
        <Fact label="Phone" value={formatPhone(current.phone)} mono />
        <Fact label="Duration" value={isConnected(current) ? clock(current.durationSec) : "Not connected"} mono />
        <Fact label="Employee" value={current.employee ?? ""} />
        <Fact label="Source" value={current.source === "phone" ? current.simLabel || "Phone" : SOURCE_LABEL[current.source]} />
      </View>

      <RecordingPlayer
        callId={current.id}
        status={current.recording.status}
        durationSec={current.durationSec}
        seek={seek}
        marks={(comments.data ?? []).flatMap((c) => (c.atSec === null ? [] : [c.atSec]))}
        positionRef={positionRef}
      />

      <ReviewPanel
        callId={current.id}
        durationSec={current.durationSec}
        repName={current.employee ?? ""}
        isOwnCall={current.userId === me}
        comments={comments}
        focusId={focusCommentId}
        positionRef={positionRef}
        onSeek={(sec) => setSeek((s) => ({ sec, n: (s?.n ?? 0) + 1 }))}
      />

      <InsightsPanel
        call={current}
        tz={tz}
        dispositions={company?.dispositions ?? []}
        repName={current.employee ?? "Rep"}
        onSeek={(sec) => setSeek((s) => ({ sec, n: (s?.n ?? 0) + 1 }))}
        onAcceptStatus={(key) => save({ leadStatus: key })}
        onTranscribe={() => transcribe.mutate()}
        transcribing={transcribe.isPending}
      />
      {transcribe.isError ? <Banner tone="error" message={apiErrorMessage(transcribe.error)} /> : null}

      {update.isError ? <Banner tone="error" message={apiErrorMessage(update.error)} /> : null}

      <View style={styles.block}>
        <Text variant="label">How did it go?</Text>
        <View style={styles.chips} accessibilityRole="radiogroup">
          {(company?.dispositions ?? []).map((d) => (
            <Chip
              key={d.key}
              role="radio"
              label={d.label}
              tone={d.tone}
              selected={current.leadStatus === d.key}
              onPress={() => save({ leadStatus: current.leadStatus === d.key ? null : d.key })}
            />
          ))}
        </View>
      </View>

      <View style={styles.block}>
        <View style={styles.rowBetween}>
          <Text variant="label">Follow-up</Text>
          {fu ? (
            <Text variant="mono" style={[styles.fuWhen, !current.followUpDone && fu.getTime() < now && { color: palette.missed }]}>
              {current.followUpDone ? "Done · " : ""}
              {dateTimeIn(fu, tz)}
            </Text>
          ) : null}
        </View>
        <View style={styles.chips}>
          {presets(new Date(now)).map((p) => (
            <Chip key={p.label} label={p.label} onPress={() => save({ followUpAt: p.at.toISOString() })} />
          ))}
        </View>
        {fu ? (
          <View style={styles.inline}>
            <Button
              kind="ghost"
              size="sm"
              label={current.followUpDone ? "Mark not done" : "Mark done"}
              onPress={() => save({ followUpDone: !current.followUpDone })}
            />
            <Button kind="quiet" size="sm" label="Remove follow-up" onPress={() => save({ followUpAt: null })} />
          </View>
        ) : null}
      </View>

      <WhatsAppComposer phone={current.phone} contactName={current.contactName} followUpAt={current.followUpAt} tz={tz} />

      <View style={styles.block}>
        <Text variant="label" nativeID="notes-label">
          Notes
        </Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          multiline
          maxLength={2000}
          placeholder="What was promised, what they asked for…"
          placeholderTextColor={palette.ink3}
          aria-labelledby="notes-label"
          accessibilityLabel="Notes"
          style={styles.notes}
        />
        <Button size="sm" label="Save notes" disabled={notes === current.notes} loading={update.isPending} onPress={() => save({ notes })} />
      </View>

      <Rule />
      <View style={styles.rowBetween}>
        <View>
          <Text variant="caption" tone="tertiary">
            Client
          </Text>
          <Text variant="bodyMedium">{current.dealStatus ? DEAL_LABEL[current.dealStatus] : "Open"}</Text>
        </View>
        <Button
          kind="ghost"
          size="sm"
          label="All calls with this client"
          onPress={() => {
            onShowClient(current.phone);
            onClose();
          }}
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  typeLine: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  facts: { flexDirection: "row", flexWrap: "wrap", borderTopWidth: 1, borderLeftWidth: 1, borderColor: palette.rule },
  fact: { width: "50%", padding: space.md, borderRightWidth: 1, borderBottomWidth: 1, borderColor: palette.rule, gap: 2 },
  block: { gap: space.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md },
  fuWhen: { fontSize: 12 },
  inline: { flexDirection: "row", gap: space.sm },
  notes: {
    minHeight: 88,
    borderWidth: 1,
    borderColor: palette.ruleStrong,
    borderRadius: radius.md,
    padding: space.md,
    fontFamily: fonts.text,
    fontSize: 15,
    color: palette.ink,
    backgroundColor: palette.paper,
    textAlignVertical: "top",
  },
});
