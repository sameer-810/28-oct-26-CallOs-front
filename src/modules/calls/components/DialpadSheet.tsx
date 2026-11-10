import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { fonts, palette, radius, space } from "@shared/designSystem";
import { Icon, Sheet, Text } from "@shared/ui";
import { callNumber, whatsappNumber } from "./QuickActions";

const KEYS = [
  ["1", ""],
  ["2", "ABC"],
  ["3", "DEF"],
  ["4", "GHI"],
  ["5", "JKL"],
  ["6", "MNO"],
  ["7", "PQRS"],
  ["8", "TUV"],
  ["9", "WXYZ"],
  ["*", ""],
  ["0", "+"],
  ["#", ""],
] as const;

/**
 * A dialpad inside the app, so a rep calling a new lead never leaves the log:
 * type or paste, then call (on the work SIM's dialler) or open WhatsApp.
 */
export function DialpadSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [number, setNumber] = useState("");
  const ready = number.replace(/\D/g, "").length >= 3;

  const press = (k: string) => setNumber((n) => (n + k).slice(0, 20));
  const paste = async () => {
    const t = await Clipboard.getStringAsync();
    const cleaned = t.replace(/[^\d+*#]/g, "").slice(0, 20);
    if (cleaned) setNumber(cleaned);
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Dialpad">
      <View style={styles.display}>
        <Pressable onPress={() => void paste()} accessibilityRole="button" accessibilityLabel="Paste a number" hitSlop={8}>
          <Icon name="copy" color={palette.ink3} />
        </Pressable>
        <Text style={styles.number} numberOfLines={1} accessibilityLiveRegion="polite">
          {number || " "}
        </Text>
        <Pressable
          onPress={() => setNumber((n) => n.slice(0, -1))}
          onLongPress={() => setNumber("")}
          accessibilityRole="button"
          accessibilityLabel="Delete"
          accessibilityHint="Hold to clear"
          hitSlop={8}
        >
          <Icon name="backspace" color={palette.ink3} />
        </Pressable>
      </View>

      <View style={styles.grid}>
        {KEYS.map(([k, sub]) => (
          <Pressable
            key={k}
            onPress={() => press(k)}
            onLongPress={k === "0" ? () => press("+") : undefined}
            accessibilityRole="button"
            accessibilityLabel={k}
            style={({ pressed }) => [styles.key, pressed && styles.keyDown]}
          >
            <Text style={styles.keyText}>{k}</Text>
            <Text style={styles.keySub}>{sub}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.actions}>
        <Pressable
          disabled={!ready}
          onPress={() => void whatsappNumber(number)}
          accessibilityRole="button"
          accessibilityLabel="Open in WhatsApp"
          style={[styles.round, { backgroundColor: palette.connected }, !ready && styles.off]}
        >
          <Icon name="whatsapp" size={24} color={palette.white} />
        </Pressable>
        <Pressable
          disabled={!ready}
          onPress={() => {
            void callNumber(number);
            onClose();
          }}
          accessibilityRole="button"
          accessibilityLabel={`Call ${number}`}
          style={[styles.round, styles.call, !ready && styles.off]}
        >
          <Icon name="phone" size={26} color={palette.paper} />
        </Pressable>
        <View style={styles.round} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  display: { flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.sm },
  number: { flex: 1, textAlign: "center", fontFamily: fonts.mono, fontSize: 30, color: palette.ink, letterSpacing: 1 },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: space.md },
  key: {
    width: "31%",
    height: 62,
    borderRadius: radius.xl,
    backgroundColor: palette.paper,
    alignItems: "center",
    justifyContent: "center",
  },
  keyDown: { backgroundColor: palette.paper2 },
  keyText: { fontFamily: fonts.textMedium, fontSize: 24, color: palette.ink },
  keySub: { fontFamily: fonts.mono, fontSize: 9.5, color: palette.ink3, minHeight: 12 },
  actions: { flexDirection: "row", justifyContent: "space-evenly", alignItems: "center" },
  round: { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center" },
  call: { backgroundColor: palette.ink, width: 68, height: 68, borderRadius: 34 },
  off: { opacity: 0.35 },
});
