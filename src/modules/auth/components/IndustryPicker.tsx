import { Pressable, StyleSheet, View } from "react-native";
import { fonts, palette, radius } from "@shared/designSystem";
import { Text, type PressState } from "@shared/ui";
import { INDUSTRIES, INDUSTRY_LABEL, type Industry } from "../types";

/** A radio group drawn as chips. Picks which call scripts the company starts with. */
export function IndustryPicker({ value, onChange, label = "What do you sell?" }: { value: Industry; onChange: (v: Industry) => void; label?: string }) {
  return (
    <View style={styles.wrap}>
      <Text variant="label" nativeID="industry-label">
        {label}
      </Text>
      <View style={styles.row} accessibilityRole="radiogroup" aria-labelledby="industry-label">
        {INDUSTRIES.map((id) => {
          const on = id === value;
          return (
            <Pressable
              key={id}
              accessibilityRole="radio"
              aria-checked={on}
              onPress={() => onChange(id)}
              style={({ hovered }: PressState) => [styles.chip, on && styles.on, hovered && !on && styles.hover]}
            >
              <Text style={[styles.text, on && styles.textOn]}>{INDUSTRY_LABEL[id]}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.ruleStrong,
    backgroundColor: palette.card,
  },
  hover: { borderColor: palette.ink },
  on: { backgroundColor: palette.ink, borderColor: palette.ink },
  text: { fontFamily: fonts.textMedium, fontSize: 13, color: palette.ink },
  textOn: { color: palette.paper },
});
