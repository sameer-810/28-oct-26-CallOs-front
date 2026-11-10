import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CallTracker } from "@/modules/call-tracker";
import { useAuthStore } from "@shared/store/useAuthStore";
import { fonts, palette, radius, space } from "@shared/designSystem";
import { Banner, Button, Icon, Sheet, Text } from "@shared/ui";
import { Brand } from "@shared/ui/BrandMark";
import { useDeviceStore } from "../deviceStore";
import { usePhoneHealth } from "../hooks/usePhoneHealth";
import { useSyncNow } from "../hooks/useSync";
import { HealthSheet } from "./HealthSheet";

/** "10-11-2026 04:05 PM", as the phone's own clock shows it. */
function stamp(ms: number) {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  const h = d.getHours() % 12 || 12;
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()} ${p(h)}:${p(d.getMinutes())} ${d.getHours() < 12 ? "AM" : "PM"}`;
}

function SyncSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const lastSyncAt = useDeviceStore((s) => s.lastSyncAt);
  const lastError = useDeviceStore((s) => s.lastError);
  const pending = useDeviceStore((s) => s.pending.length);
  const alarms = useDeviceStore((s) => s.alarms);
  const sync = useSyncNow();
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Call sync"
      footer={<Button label="Resync now" loading={sync.isPending} onPress={() => sync.mutate()} testID="resync" />}
    >
      {lastError ? (
        <Banner tone="error" message={lastError} />
      ) : (
        <View style={styles.line}>
          <Icon name="check" color={palette.connected} />
          <Text>All calls are synced to your account.</Text>
        </View>
      )}
      <View style={styles.line}>
        <Icon name="clock" color={palette.ink3} />
        <Text tone="secondary">Last synced: {lastSyncAt ? stamp(lastSyncAt) : "not yet"}</Text>
      </View>
      {pending ? (
        <View style={styles.line}>
          <Icon name="folder" color={palette.ink3} />
          <Text tone="secondary">
            {pending} recording{pending === 1 ? "" : "s"} waiting to be found and uploaded
          </Text>
        </View>
      ) : null}
      <View style={styles.line}>
        <Icon name="bell" color={palette.ink3} />
        <Text tone="secondary">
          {alarms ? `${alarms} follow-up reminder${alarms === 1 ? "" : "s"} set on this phone` : "No follow-up reminders set"}
        </Text>
      </View>
    </Sheet>
  );
}

/**
 * The phone's header: brand, sync state, and the setup shield with how many
 * checks fail — plus the "Finish setup" strip under it while any do. Android
 * only; a laptop has the sidebar and no phone to set up.
 */
export function PhoneTopBar() {
  const insets = useSafeAreaInsets();
  const setupDone = useDeviceStore((s) => s.setupDone);
  const lastError = useDeviceStore((s) => s.lastError);
  const simChanged = useDeviceStore((s) => s.simChanged);
  const signedIn = useAuthStore((s) => s.isAuthenticated);
  const { checks } = usePhoneHealth();
  const [sheet, setSheet] = useState<"sync" | "health" | null>(null);
  if (!CallTracker || !signedIn || !checks) return null;

  const failing = checks.total - checks.passing;
  return (
    <View style={{ paddingTop: insets.top, backgroundColor: palette.card }}>
      <View style={styles.bar}>
        <Brand />
        {/* nothing to sync or fix until this phone tracks calls */}
        {setupDone ? (
        <View style={styles.actions}>
          <Pressable
            onPress={() => setSheet("sync")}
            accessibilityRole="button"
            accessibilityLabel={lastError ? "Sync needs attention" : "Calls synced"}
            hitSlop={8}
            style={styles.iconBtn}
          >
            <Icon name="sync" size={22} color={lastError ? palette.missed : palette.ink} />
          </Pressable>
          <Pressable
            onPress={() => setSheet("health")}
            accessibilityRole="button"
            accessibilityLabel={failing ? `${failing} setup checks need attention` : "Phone setup complete"}
            hitSlop={8}
            style={styles.iconBtn}
          >
            <Icon name="shield" size={22} color={failing ? palette.missed : palette.connected} />
            {failing ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{failing}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>
        ) : null}
      </View>

      {simChanged ? (
        <Pressable style={[styles.strip, { backgroundColor: palette.missedBg }]} onPress={() => useDeviceStore.getState().set({ setupDone: false, setupSkipped: false })}>
          <Icon name="sim" color={palette.missed} />
          <Text variant="label" tone="missed" style={{ flex: 1 }}>
            SIM change detected. Set up your SIMs again to continue call tracking.
          </Text>
          <Icon name="chevron" color={palette.missed} />
        </Pressable>
      ) : setupDone && failing ? (
        <Pressable style={styles.strip} onPress={() => setSheet("health")} accessibilityRole="button">
          <Icon name="rocket" color={palette.ink} />
          <Text variant="label" style={{ flex: 1 }}>
            Finish setup: {failing} step{failing === 1 ? "" : "s"} left for reliable background call sync.
          </Text>
          <Text variant="label" style={styles.cta}>
            Set up
          </Text>
        </Pressable>
      ) : null}

      <SyncSheet visible={sheet === "sync"} onClose={() => setSheet(null)} />
      <HealthSheet visible={sheet === "health"} onClose={() => setSheet(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: palette.rule,
  },
  actions: { flexDirection: "row", gap: space.sm },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  badge: {
    position: "absolute",
    top: 2,
    right: 0,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: radius.pill,
    backgroundColor: palette.missed,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { fontFamily: fonts.monoMedium, fontSize: 10.5, color: palette.white },
  strip: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    backgroundColor: palette.markerSoft,
    borderBottomWidth: 1,
    borderBottomColor: palette.rule,
  },
  cta: { textDecorationLine: "underline" },
  line: { flexDirection: "row", alignItems: "center", gap: space.md },
});
