import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { useAuthStore } from "@shared/store/useAuthStore";
import { spacedCode } from "@shared/format";
import { fonts, palette, radius } from "@shared/designSystem";
import { Text, type PressState } from "@shared/ui";

/**
 * The company code, one tap to copy, wherever a manager is — the thing they
 * read out most when someone new starts. Renders nothing for reps: the API
 * never sends them the code.
 */
export function ConnectCode() {
  const code = useAuthStore((s) => s.company?.code ?? null);
  const [copied, setCopied] = useState(false);
  if (!code) return null;
  return (
    <Pressable
      onPress={async () => {
        await Clipboard.setStringAsync(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }}
      accessibilityRole="button"
      accessibilityLabel={copied ? "Company code copied" : `Copy company code ${code.split("").join(" ")}`}
      style={({ hovered }: PressState) => [styles.box, hovered && styles.hover]}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.label}>Connect code</Text>
        <Text style={styles.code}>{spacedCode(code)}</Text>
      </View>
      <Text style={styles.copy}>{copied ? "Copied" : "Copy"}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.ruleStrong,
    backgroundColor: palette.card,
  },
  hover: { borderColor: palette.ink },
  label: { fontFamily: fonts.mono, fontSize: 10, color: palette.ink3, textTransform: "uppercase", letterSpacing: 0.5 },
  code: { fontFamily: fonts.monoMedium, fontSize: 15, color: palette.ink, letterSpacing: 1 },
  copy: { fontFamily: fonts.textMedium, fontSize: 12, color: palette.ink2, backgroundColor: palette.markerSoft, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm },
});
