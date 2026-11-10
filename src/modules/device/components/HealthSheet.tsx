import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { CallTracker } from "@/modules/call-tracker";
import { palette, radius, space } from "@shared/designSystem";
import { Banner, Button, Icon, Sheet, Text } from "@shared/ui";
import { useDeviceStore } from "../deviceStore";
import { askPermissions } from "../permissions";
import { usePhoneHealth } from "../hooks/usePhoneHealth";
import { reportDevice } from "../syncEngine";
import type { CheckItem } from "../phoneChecks";

const AMBER = "#9A6B00";
const AMBER_BG = "#FBF0D2";

/** The score as a ring: full and green when everything passes. */
function Ring({ passing, total }: { passing: number; total: number }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const share = total ? passing / total : 0;
  const ok = passing === total;
  const color = ok ? palette.connected : share >= 0.75 ? AMBER : palette.missed;
  return (
    <View style={styles.ring} accessibilityLabel={`${Math.round(share * 100)}%`}>
      <Svg width={84} height={84} viewBox="0 0 84 84">
        <Circle cx={42} cy={42} r={r} stroke={palette.rule} strokeWidth={7} fill="none" />
        <Circle
          cx={42}
          cy={42}
          r={r}
          stroke={color}
          strokeWidth={7}
          fill="none"
          strokeDasharray={`${c * share} ${c}`}
          strokeLinecap="round"
          transform="rotate(-90 42 42)"
        />
      </Svg>
      <View style={styles.ringMid}>
        <Text variant="label" style={{ color }}>
          {Math.round(share * 100)}%
        </Text>
      </View>
    </View>
  );
}

/** "Open Settings" then "I've done this" — for the switches Android can't report or can only show. */
function Guide({ item, onDone, onClose }: { item: CheckItem; onDone: () => void; onClose: () => void }) {
  const fix = item.fix;
  if (fix.kind !== "setting") return null;
  return (
    <View style={styles.guide}>
      <Text variant="heading">{item.title}</Text>
      <Text tone="secondary">
        {fix.screen === "overlay"
          ? "Find Ringwise in the list, then turn the switch on. Come back here when it's on."
          : "Find Ringwise in the list and turn its switch on, so calls keep syncing in the background."}
      </Text>
      <Button label="Open Settings" onPress={() => CallTracker?.openSetting(fix.screen)} />
      <View style={styles.row}>
        <Button kind="ghost" label="Back" onPress={onClose} />
        <Button kind="quiet" label="I've done this" onPress={onDone} />
      </View>
    </View>
  );
}

/**
 * The setup checklist (the header's shield and the "Finish setup" banner open
 * it): every phone setting that silently stops calls or recordings, each with
 * the one tap that fixes it.
 */
export function HealthSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { checks, refresh } = usePhoneHealth(visible);
  const set = useDeviceStore((s) => s.set);
  const [guide, setGuide] = useState<CheckItem | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const health = CallTracker?.getHealth();

  if (!checks) return null;

  const after = () => {
    refresh();
    void reportDevice().catch(() => {});
  };

  const fix = async (item: CheckItem) => {
    setNote(null);
    const f = item.fix;
    if (f.kind === "permission") {
      const ok = await askPermissions(f.permissions);
      if (!ok) {
        setNote(`${item.title}: allow it under Permissions on the next screen.`);
        CallTracker?.openSetting(f.permissions[0] === "notifications" ? "notifications" : "app");
      }
    } else if (f.kind === "folder") {
      if (!CallTracker?.getPermissions().recordings) await askPermissions(["recordings"]);
      const picked = await CallTracker?.pickRecordingFolder();
      if (picked) set({ recordingFolder: picked.label });
    } else if (f.screen === "overlay" || f.confirm) {
      setGuide(item);
      return;
    } else {
      CallTracker?.openSetting(f.screen);
    }
    after();
  };

  const ok = checks.passing === checks.total;
  return (
    <Sheet visible={visible} onClose={onClose} title="Phone setup">
      {guide ? (
        <Guide
          item={guide}
          onClose={() => setGuide(null)}
          onDone={() => {
            if (guide.key === "autostart") set({ autostartConfirmed: true });
            setGuide(null);
            after();
          }}
        />
      ) : (
        <>
          <View style={styles.head}>
            <Ring passing={checks.passing} total={checks.total} />
            <View style={{ flex: 1, gap: space.xs }}>
              <Text variant="heading">{ok ? "All set" : "Action needed"}</Text>
              <Text tone="secondary">
                {ok
                  ? "Every check passes: calls and recordings will arrive on their own."
                  : `${checks.passing} of ${checks.total} checks passing — calls or recordings may not arrive as they should.`}
              </Text>
            </View>
          </View>
          {note ? <Banner tone="info" message={note} /> : null}
          {checks.items.map((item) => (
            <View
              key={item.key}
              style={[styles.item, !item.ok && (item.soft ? styles.itemWarn : styles.itemBad)]}
              accessibilityLabel={`${item.title}: ${item.ok ? "done" : "needs attention"}`}
            >
              <View style={[styles.state, { backgroundColor: item.ok ? palette.connectedBg : item.soft ? AMBER_BG : palette.missedBg }]}>
                <Icon
                  name={item.ok ? "check" : "alert"}
                  size={18}
                  color={item.ok ? palette.connected : item.soft ? AMBER : palette.missed}
                />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="label">{item.title}</Text>
                <Text variant="caption" tone="secondary">
                  {item.why}
                </Text>
              </View>
              {item.ok ? null : (
                <Pressable
                  onPress={() => void fix(item)}
                  accessibilityRole="button"
                  accessibilityLabel={`Fix ${item.title}`}
                  style={[styles.fix, { backgroundColor: item.soft ? AMBER : palette.missed }]}
                >
                  <Text variant="label" style={{ color: palette.white }}>
                    Fix
                  </Text>
                </Pressable>
              )}
            </View>
          ))}

          {/* optional, outside the score: WhatsApp calls only if the team uses them */}
          <View style={[styles.item, styles.optional]}>
            <View style={[styles.state, { backgroundColor: health?.whatsapp ? palette.connectedBg : palette.paper2 }]}>
              <Icon name="whatsapp" size={18} color={health?.whatsapp ? palette.connected : palette.ink3} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="label">WhatsApp call logging · optional</Text>
              <Text variant="caption" tone="secondary">
                Allow notification access so WhatsApp voice and video calls are logged too.
              </Text>
            </View>
            {health?.whatsapp ? null : (
              <Button kind="ghost" size="sm" label="Turn on" onPress={() => CallTracker?.openSetting("whatsapp")} />
            )}
          </View>
        </>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: space.lg },
  ring: { width: 84, height: 84 },
  ringMid: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.md,
    borderWidth: 1,
    borderColor: palette.rule,
    borderRadius: radius.lg,
    backgroundColor: palette.card,
  },
  itemBad: { borderColor: palette.missed },
  itemWarn: { borderColor: AMBER },
  optional: { borderStyle: "dashed" },
  state: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  fix: { paddingHorizontal: space.lg, paddingVertical: space.sm, borderRadius: radius.pill },
  guide: { gap: space.lg },
  row: { flexDirection: "row", justifyContent: "space-between", gap: space.sm },
});
