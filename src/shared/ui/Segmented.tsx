import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { fonts, palette, radius } from "../designSystem";
import { Text } from "./Text";

interface Props<T extends string> {
  value: T;
  onChange: (v: T) => void;
  items: { id: T; label: string; count?: number }[];
  label: string;
  /** Scroll sideways instead of wrapping, for long lists on a phone. */
  scroll?: boolean;
}

/** One-of-many switch drawn as a pill track. Announced as tabs. */
export function Segmented<T extends string>({ value, onChange, items, label, scroll }: Props<T>) {
  const body = (
    <View style={styles.track} accessibilityRole="tablist" accessibilityLabel={label}>
      {items.map((it) => {
        const on = it.id === value;
        return (
          <Pressable
            key={it.id}
            accessibilityRole="tab"
            aria-selected={on}
            onPress={() => onChange(it.id)}
            style={[styles.btn, on && styles.on]}
          >
            <Text style={[styles.text, on && styles.textOn]}>{it.label}</Text>
            {it.count !== undefined ? (
              <Text style={[styles.count, on && styles.textOn]}>{it.count}</Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
  return scroll ? (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 4 }}>
      {body}
    </ScrollView>
  ) : (
    body
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    padding: 3,
    borderWidth: 1,
    borderColor: palette.ruleStrong,
    borderRadius: radius.md + 2,
    backgroundColor: palette.card,
    alignSelf: "flex-start",
  },
  btn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.sm + 1 },
  on: { backgroundColor: palette.ink },
  text: { fontFamily: fonts.textMedium, fontSize: 13, color: palette.ink2 },
  textOn: { color: palette.paper },
  count: { fontFamily: fonts.mono, fontSize: 11, color: palette.ink3 },
});
