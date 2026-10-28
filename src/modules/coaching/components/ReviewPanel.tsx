import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import type { UseQueryResult } from "@tanstack/react-query";
import { apiErrorMessage } from "@api/apiClient";
import { useAuthStore } from "@shared/store/useAuthStore";
import { clock, firstName, parseClock, timeAgo } from "@shared/format";
import { useNow } from "@shared/hooks/useNow";
import { fonts, palette, radius, space } from "@shared/designSystem";
import { Banner, Button, Text, type PressState } from "@shared/ui";
import type { PositionRef } from "@modules/calls/components/RecordingPlayer";
import type { CallComment } from "../types";
import { useAddComment, useRemoveComment } from "../hooks/useComments";

const ROLE: Record<string, string> = { owner: "Owner", manager: "Manager", rep: "Rep" };

function Moment({ sec, onPress }: { sec: number; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Play from ${clock(sec)}`}
      hitSlop={4}
      style={({ hovered }: PressState) => [styles.moment, hovered && { borderColor: palette.ink }]}
    >
      <Text style={styles.momentText}>▶ {clock(sec)}</Text>
    </Pressable>
  );
}

/**
 * The review of one call: comments pinned to moments in the recording, in
 * the order they were written. A manager writes for the rep; the rep answers
 * on the same call. Whoever is on the other side is notified.
 */
export function ReviewPanel({
  callId,
  durationSec,
  repName,
  isOwnCall,
  comments,
  focusId,
  positionRef,
  onSeek,
}: {
  callId: string;
  durationSec: number;
  repName: string;
  isOwnCall: boolean;
  comments: UseQueryResult<CallComment[]>;
  /** The comment a notification pointed at, highlighted. */
  focusId?: string | null;
  positionRef: PositionRef;
  onSeek: (sec: number) => void;
}) {
  const role = useAuthStore((s) => s.user?.role);
  const now = useNow();
  const [text, setText] = useState("");
  const [at, setAt] = useState("");
  const atSec = at.trim() ? parseClock(at) : null;
  const atError = at.trim() && (atSec === null || atSec > durationSec + 1) ? `Use m:ss, up to ${clock(durationSec)}` : null;

  const add = useAddComment(callId);
  const remove = useRemoveComment(callId);
  const send = () =>
    add.mutate(
      { text: text.trim(), atSec: at.trim() ? atSec : null },
      {
        onSuccess: () => {
          setText("");
          setAt("");
        },
      },
    );

  const list = comments.data ?? [];
  const placeholder = isOwnCall ? "Reply, or ask about a moment…" : `What should ${firstName(repName) || "the rep"} hear about this call?`;

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text variant="label">Review</Text>
        <Text variant="caption" tone="tertiary">
          {list.length ? `${list.length} comment${list.length === 1 ? "" : "s"}` : isOwnCall ? "Your manager’s notes will appear here" : "Pin a note to a moment"}
        </Text>
      </View>

      {list.map((c) => (
        <View key={c.id} style={[styles.comment, c.id === focusId && styles.focused]} testID={c.id === focusId ? "focused-comment" : undefined}>
          <View style={styles.byline}>
            {c.atSec !== null ? <Moment sec={c.atSec} onPress={() => onSeek(c.atSec!)} /> : null}
            <Text variant="bodyMedium" numberOfLines={1} style={{ flexShrink: 1 }}>
              {c.mine ? "You" : c.author.name}
            </Text>
            {c.author.role ? (
              <Text variant="caption" tone="tertiary">
                {ROLE[c.author.role]}
              </Text>
            ) : null}
            <Text variant="caption" tone="tertiary" style={{ marginLeft: "auto" }}>
              {timeAgo(c.createdAt, now)}
            </Text>
          </View>
          <Text style={styles.body}>{c.text}</Text>
          {c.mine || role !== "rep" ? (
            <Pressable
              onPress={() => remove.mutate(c.id)}
              accessibilityRole="button"
              accessibilityLabel={`Delete comment${c.atSec !== null ? ` at ${clock(c.atSec)}` : ""}`}
              hitSlop={6}
              style={styles.delete}
            >
              <Text variant="caption" tone="tertiary">
                Delete
              </Text>
            </Pressable>
          ) : null}
        </View>
      ))}

      <View style={styles.composer}>
        <TextInput
          value={text}
          onChangeText={setText}
          multiline
          maxLength={1000}
          placeholder={placeholder}
          placeholderTextColor={palette.ink3}
          accessibilityLabel="Your comment"
          style={styles.input}
        />
        <View style={styles.composerFoot}>
          <View style={styles.atBox}>
            <Text variant="caption" tone="secondary">
              At
            </Text>
            <TextInput
              value={at}
              onChangeText={setAt}
              placeholder="m:ss"
              placeholderTextColor={palette.ink3}
              accessibilityLabel="Moment in the call"
              inputMode="numeric"
              style={[styles.at, atError && { borderColor: palette.missed }]}
            />
            {durationSec > 0 ? (
              <Button kind="quiet" size="sm" label="Now" accessibilityHint="Use where the recording is playing" onPress={() => setAt(clock(Math.floor(positionRef.current)))} />
            ) : null}
          </View>
          <Button size="sm" label={isOwnCall && role === "rep" ? "Reply" : "Comment"} disabled={!text.trim() || Boolean(atError)} loading={add.isPending} onPress={send} />
        </View>
        {atError ? (
          <Text variant="caption" tone="missed">
            {atError}
          </Text>
        ) : (
          <Text variant="caption" tone="tertiary">
            {isOwnCall ? "Your manager is told when you reply." : `${firstName(repName) || "The rep"} is told, and the call opens at that moment.`}
          </Text>
        )}
      </View>
      {add.isError || remove.isError ? <Banner tone="error" message={apiErrorMessage(add.error ?? remove.error)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  head: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: space.md },
  comment: { gap: 4, paddingVertical: space.sm, paddingHorizontal: space.md, borderLeftWidth: 2, borderLeftColor: palette.ruleStrong },
  focused: { borderLeftColor: palette.ink, backgroundColor: palette.markerSoft, borderRadius: radius.sm },
  byline: { flexDirection: "row", alignItems: "center", gap: space.sm, flexWrap: "wrap" },
  moment: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm, backgroundColor: palette.marker, borderWidth: 1, borderColor: "transparent" },
  momentText: { fontFamily: fonts.monoMedium, fontSize: 11.5, color: palette.ink },
  body: { fontFamily: fonts.text, fontSize: 14.5, lineHeight: 21, color: palette.ink },
  delete: { alignSelf: "flex-start" },
  composer: { gap: space.sm, marginTop: space.xs },
  input: {
    minHeight: 64,
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
  composerFoot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.sm, flexWrap: "wrap" },
  atBox: { flexDirection: "row", alignItems: "center", gap: space.xs },
  at: {
    width: 64,
    height: 36,
    borderWidth: 1,
    borderColor: palette.ruleStrong,
    borderRadius: radius.md,
    paddingHorizontal: space.sm,
    fontFamily: fonts.mono,
    fontSize: 14,
    color: palette.ink,
    backgroundColor: palette.paper,
  },
});
