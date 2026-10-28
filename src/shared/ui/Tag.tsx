import { StyleSheet, View } from "react-native";
import { fonts, palette, radius } from "../designSystem";
import { Text } from "./Text";

type Tone = "neutral" | "ink" | "connected" | "missed" | "dashed";

/** Small uppercase label: a role, a status. State is in the word, colour backs it up. */
export function Tag({ label, tone = "neutral" }: { label: string; tone?: Tone }) {
  return (
    <View style={[styles.tag, toneStyle[tone]]}>
      {tone === "connected" ? <View style={styles.dot} /> : null}
      <Text
        style={[
          styles.text,
          {
            color:
              tone === "ink"
                ? palette.paper
                : tone === "connected"
                  ? palette.connected
                  : tone === "missed"
                    ? palette.missed
                    : palette.ink2,
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: palette.connected },
  text: { fontFamily: fonts.monoMedium, fontSize: 10.5, letterSpacing: 0.6, textTransform: "uppercase" },
});

const toneStyle = StyleSheet.create({
  neutral: { borderColor: palette.ruleStrong },
  ink: { borderColor: palette.ink, backgroundColor: palette.ink },
  connected: { borderColor: palette.connected },
  missed: { borderColor: palette.missed },
  dashed: { borderColor: palette.ruleStrong, borderStyle: "dashed" },
});
