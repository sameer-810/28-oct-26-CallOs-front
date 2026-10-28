import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { clock, formatPhone } from "@shared/format";
import { fonts, palette, radius, space } from "@shared/designSystem";
import { Text } from "@shared/ui";
import { useAuthStore } from "@shared/store/useAuthStore";
import { phone, useCallStore } from "../useCallStore";
import { useRefreshAfterCall, useTelephony } from "../hooks/useTelephony";
import { useNow } from "@shared/hooks/useNow";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];

function Btn({ label, onPress, tone = "ghost", on }: { label: string; onPress: () => void; tone?: "ghost" | "end" | "go"; on?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      aria-pressed={on}
      onPress={onPress}
      style={[styles.btn, tone === "end" && styles.end, tone === "go" && styles.go, on && styles.on]}
    >
      <Text style={[styles.btnText, (tone !== "ghost" || on) && { color: palette.paper }]}>{label}</Text>
    </Pressable>
  );
}

/**
 * The live call, pinned to the bottom of the browser window: who, how long,
 * mute, keypad, hang up — and Accept / Decline when a client rings in.
 */
export function CallBar() {
  const s = useCallStore();
  const refreshAfterCall = useRefreshAfterCall();
  const tel = useTelephony();
  const signedIn = useAuthStore((x) => x.isAuthenticated);
  const [keypad, setKeypad] = useState(false);
  const now = useNow(1000);

  // a browser that can take inbound calls registers as soon as the app opens
  useEffect(() => {
    if (!signedIn || phone.softphoneKind !== "browser" || !tel.data?.enabled || !tel.data.inbound) return;
    void phone.startDevice({
      onState: (st) => useCallStore.setState({ state: st }),
      onIncoming: (from) => useCallStore.setState({ incomingFrom: from, number: from, name: "" }),
      onError: (m) => useCallStore.setState({ error: m }),
    });
    return () => phone.stopDevice();
  }, [signedIn, tel.data?.enabled, tel.data?.inbound]);

  // the call just logged on the server: show it
  useEffect(() => {
    if (s.state !== "ended") return;
    const t = setTimeout(() => {
      refreshAfterCall();
      if (!s.error) useCallStore.getState().dismiss();
    }, 2500);
    return () => clearTimeout(t);
  }, [s.state, s.error, refreshAfterCall]);

  if (s.incomingFrom && s.state !== "in-call") {
    return (
      <View style={styles.bar} accessibilityRole="alert">
        <View style={[styles.dot, styles.ringing]} />
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Incoming call</Text>
          <Text style={styles.number}>{formatPhone(s.incomingFrom)}</Text>
        </View>
        <Btn label="Decline" tone="end" onPress={s.reject} />
        <Btn label="Accept" tone="go" onPress={s.accept} />
      </View>
    );
  }
  if (s.state === "idle") return null;

  const live = s.state === "in-call";
  const status = s.error
    ? s.error
    : s.state === "connecting"
      ? "Connecting…"
      : s.state === "ringing"
        ? "Ringing…"
        : s.state === "ended"
          ? "Call ended — saved to your calls"
          : clock(Math.max(0, now - (s.startedAt ?? now)) / 1000);

  return (
    <View style={styles.wrap}>
      {keypad && live ? (
        <View style={styles.keypad}>
          {KEYS.map((k) => (
            <Pressable key={k} onPress={() => s.digit(k)} accessibilityRole="button" accessibilityLabel={`Key ${k}`} style={styles.key}>
              <Text style={styles.keyText}>{k}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <View style={styles.bar} accessibilityLiveRegion="polite">
        <View style={[styles.dot, live ? styles.live : s.state === "ended" ? styles.off : styles.ringing]} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.label} numberOfLines={1}>
            {s.name || formatPhone(s.number)}
          </Text>
          <Text style={[styles.number, !!s.error && { color: "#F3B9B3" }]} numberOfLines={1}>
            {status}
          </Text>
        </View>
        {live ? (
          <>
            <Btn label={s.muted ? "Unmute" : "Mute"} on={s.muted} onPress={s.toggleMute} />
            <Btn label="Keypad" on={keypad} onPress={() => setKeypad((k) => !k)} />
          </>
        ) : null}
        {s.state === "ended" ? <Btn label="Close" onPress={s.dismiss} /> : <Btn label="End" tone="end" onPress={s.hangUp} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: space.lg, right: space.lg, bottom: space.lg, alignItems: "center", gap: space.sm },
  bar: {
    position: "relative",
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radius.xl,
    backgroundColor: palette.ink,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  live: { backgroundColor: "#4CB074" },
  ringing: { backgroundColor: palette.marker },
  off: { backgroundColor: palette.ink3 },
  label: { fontFamily: fonts.textMedium, fontSize: 14, color: palette.paper },
  number: { fontFamily: fonts.mono, fontSize: 12, color: "#C9C0AE" },
  btn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.md, borderWidth: 1, borderColor: "#4A443A" },
  on: { backgroundColor: "#4A443A" },
  end: { backgroundColor: palette.missed, borderColor: palette.missed },
  go: { backgroundColor: "#2C6B43", borderColor: "#2C6B43" },
  btnText: { fontFamily: fonts.textMedium, fontSize: 13, color: palette.paper },
  keypad: {
    width: 240,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    padding: space.md,
    borderRadius: radius.xl,
    backgroundColor: palette.ink,
    justifyContent: "center",
  },
  key: { width: 64, height: 44, borderRadius: radius.md, borderWidth: 1, borderColor: "#4A443A", alignItems: "center", justifyContent: "center" },
  keyText: { fontFamily: fonts.monoMedium, fontSize: 18, color: palette.paper },
});
