import { StyleSheet, View } from "react-native";
import { CallTracker } from "@/modules/call-tracker";
import { timeAgo } from "@shared/format";
import { palette, space } from "@shared/designSystem";
import { Banner, Button, Card, Text } from "@shared/ui";
import { useNow } from "@shared/hooks/useNow";
import { useDeviceStore } from "../deviceStore";
import { useSyncNow } from "../hooks/useSync";

/** On the rep's own Android phone: is it sending calls, and a way to nudge it. */
export function PhoneStatus() {
  const d = useDeviceStore();
  const sync = useSyncNow();
  const now = useNow(30_000);
  if (!CallTracker) return null;

  if (!d.setupDone) {
    return (
      <Card style={styles.card}>
        <Text variant="heading">Call tracking is off on this phone</Text>
        <Text variant="caption" tone="secondary">
          Set it up once and your work calls, recordings and notes arrive here on their own.
        </Text>
        <Button label="Set up call tracking" onPress={() => d.set({ setupSkipped: false })} />
      </Card>
    );
  }

  const perms = CallTracker.getPermissions();
  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <View style={[styles.dot, { backgroundColor: perms.callLog && !d.lastError ? palette.connected : palette.missed }]} />
        <View style={{ flex: 1 }}>
          <Text variant="heading">{perms.callLog ? "This phone is sending calls" : "Call log access is off"}</Text>
          <Text variant="caption" tone="secondary">
            {d.simLabel ? `${d.simLabel} · ` : ""}
            {d.lastSyncAt ? `last sent ${timeAgo(new Date(d.lastSyncAt).toISOString(), now)}` : "not sent yet"}
            {d.pending.length ? ` · ${d.pending.length} recording${d.pending.length === 1 ? "" : "s"} waiting` : ""}
          </Text>
        </View>
        <Button
          kind="ghost"
          size="sm"
          label="Sync now"
          loading={sync.isPending}
          onPress={() => sync.mutate()}
        />
      </View>
      {d.lastError ? <Banner tone="error" message={d.lastError} /> : null}
      {!perms.callLog ? <Button label="Fix permissions" onPress={() => d.set({ setupDone: false, setupSkipped: false })} /> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md },
  row: { flexDirection: "row", alignItems: "center", gap: space.md },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
