import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { CallTracker, type SharedAudio } from "@/modules/call-tracker";
import { apiErrorMessage } from "@api/apiClient";
import { useAuthStore } from "@shared/store/useAuthStore";
import { clock, dateTimeIn, formatPhone } from "@shared/format";
import { palette, space } from "@shared/designSystem";
import { Banner, Button, Sheet, Text } from "@shared/ui";
import { CallGlyph } from "@shared/ui/CallGlyph";
import { useAttachRecording, useCalls } from "../hooks/useCalls";

/**
 * "Share → Ringwise" on a recording: pick the call it belongs to. Offered
 * the answered calls of the last week that have no recording yet.
 */
export function SharedAudioSheet() {
  const [audio, setAudio] = useState<SharedAudio | null>(() => CallTracker?.takeSharedAudio() ?? null);
  const tz = useAuthStore((s) => s.company?.timezone ?? "Asia/Kolkata");
  const me = useAuthStore((s) => s.user?.id);
  const attach = useAttachRecording();
  const calls = useCalls({ range: "last7", recorded: "false", userIds: me, limit: 30 }, Boolean(audio && me));

  useEffect(() => {
    if (!CallTracker) return;
    const sub = CallTracker.addListener("onSharedAudio", (a) => {
      attach.reset();
      setAudio(a);
    });
    return () => sub.remove();
  }, [attach]);

  if (!audio) return null;
  const answered = (calls.data?.items ?? []).filter((c) => c.durationSec > 0);

  return (
    <Sheet visible onClose={() => setAudio(null)} title="Attach recording">
      <Text tone="secondary">
        {audio.name} — which call is it from?
      </Text>
      {attach.isError ? <Banner tone="error" message={apiErrorMessage(attach.error, "Failed to upload recording. Try again.")} /> : null}
      {attach.isSuccess ? (
        <>
          <Banner tone="success" message="Recording uploaded and attached." />
          <Button label="Done" onPress={() => setAudio(null)} />
        </>
      ) : calls.isLoading ? (
        <ActivityIndicator color={palette.ink} />
      ) : answered.length === 0 ? (
        <Text tone="tertiary">No answered calls from the last week are waiting for a recording.</Text>
      ) : (
        answered.map((c) => (
          <Pressable
            key={c.id}
            disabled={attach.isPending}
            onPress={() => attach.mutate({ callId: c.id, uri: audio.uri, name: audio.name, mime: audio.mime })}
            accessibilityRole="button"
            style={({ pressed }) => [styles.row, pressed && { backgroundColor: palette.paper }]}
          >
            <CallGlyph type={c.type} />
            <View style={{ flex: 1 }}>
              <Text variant="bodyMedium">{c.contactName || formatPhone(c.phone)}</Text>
              <Text variant="caption" tone="tertiary">
                {dateTimeIn(c.startedAt, tz)} · {clock(c.durationSec)}
              </Text>
            </View>
            {attach.isPending && attach.variables?.callId === c.id ? <ActivityIndicator color={palette.ink} /> : null}
          </Pressable>
        ))
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: palette.rule,
  },
});
