import { Pressable, StyleSheet, View } from "react-native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { AppTabParamList } from "@navigation/types";
import { apiErrorMessage } from "@api/apiClient";
import { useRefreshOnFocus } from "@shared/hooks/useRefreshOnFocus";
import { useNow } from "@shared/hooks/useNow";
import { clock, timeAgo } from "@shared/format";
import { fonts, palette, space } from "@shared/designSystem";
import { Banner, Button, Card, EmptyState, Screen, Text, type PressState } from "@shared/ui";
import type { Notice } from "../types";
import { useInbox, useMarkRead } from "../hooks/useInbox";

type Props = BottomTabScreenProps<AppTabParamList, "Inbox">;

function Row({ n, now, onOpen, last }: { n: Notice; now: number; onOpen: () => void; last: boolean }) {
  const unread = !n.readAt;
  const where = n.atSec !== null ? ` at ${clock(n.atSec)}` : "";
  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`${unread ? "Unread. " : ""}${n.actorName} commented${where} on the call with ${n.subject}`}
      style={({ hovered, pressed }: PressState) => [styles.row, last && { borderBottomWidth: 0 }, (hovered || pressed) && { backgroundColor: palette.paper }]}
    >
      <View style={[styles.dot, !unread && { backgroundColor: "transparent" }]} />
      <View style={{ flex: 1, gap: 3, minWidth: 0 }}>
        <View style={styles.top}>
          <Text variant="bodyMedium" style={{ flexShrink: 1 }} numberOfLines={1}>
            {n.actorName}
            <Text tone="secondary"> on {n.subject}</Text>
          </Text>
          <Text variant="caption" tone="tertiary">
            {timeAgo(n.createdAt, now)}
          </Text>
        </View>
        <Text variant="caption" tone="secondary" numberOfLines={2}>
          {n.atSec !== null ? <Text style={styles.at}>{clock(n.atSec)} </Text> : null}
          {n.text}
        </Text>
      </View>
    </Pressable>
  );
}

/** Comments on your calls, and replies to yours. Tapping one opens the call at that moment. */
export default function InboxScreen({ navigation }: Props) {
  const now = useNow();
  const inbox = useInbox();
  useRefreshOnFocus(inbox.refetch);
  const readAll = useMarkRead();
  const readOne = useMarkRead();

  function open(n: Notice) {
    if (!n.readAt) readOne.mutate([n.id]);
    if (n.callId) navigation.navigate("Calls", { open: n.callId, at: n.atSec !== null ? String(n.atSec) : undefined, c: n.commentId ?? undefined });
  }

  const items = inbox.data?.items ?? [];
  const unread = inbox.data?.unread ?? 0;

  return (
    <Screen>
      <View style={styles.head}>
        <View>
          <Text variant="eyebrow" tone="tertiary">
            Inbox
          </Text>
          <Text variant="display" style={{ marginTop: 6 }}>
            {unread ? `${unread} new` : "All caught up"}
          </Text>
        </View>
        {unread ? <Button kind="ghost" size="sm" label="Mark all read" loading={readAll.isPending} onPress={() => readAll.mutate(undefined)} /> : null}
      </View>
      {inbox.isError ? <Banner tone="error" message={apiErrorMessage(inbox.error)} /> : null}

      {items.length ? (
        <Card padded={false} style={{ marginTop: space.xl, overflow: "hidden" }}>
          {items.map((n, i) => (
            <Row key={n.id} n={n} now={now} last={i === items.length - 1} onOpen={() => open(n)} />
          ))}
        </Card>
      ) : inbox.isSuccess ? (
        <EmptyState
          icon="bell"
          title="Nothing here yet"
          body="When a manager comments on one of your calls, or someone replies to your comment, it shows up here — and the call opens at that moment."
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: space.md, flexWrap: "wrap" },
  row: { flexDirection: "row", gap: space.md, padding: space.lg, borderBottomWidth: 1, borderBottomColor: palette.rule, alignItems: "flex-start" },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: palette.ink, marginTop: 7 },
  top: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: space.md },
  at: { fontFamily: fonts.monoMedium, fontSize: 12, color: palette.ink, backgroundColor: palette.marker },
});
