import { useRef, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { fonts, palette, radius } from "@shared/designSystem";
import { Text } from "@shared/ui";

export const CODE_LENGTH = 6;
// matches the API's alphabet: no 0/O, 1/I/L, 5/S, 2/Z, 8/B
const ALLOWED = /[34679ACDEFGHJKMNPQRTUVWXY]/g;

interface Props {
  value: string;
  onChange: (v: string) => void;
  onComplete?: (v: string) => void;
  error?: string;
}

/**
 * Six cells over one real input, so paste, autofill and screen readers all see
 * an ordinary text field. Letters the code can't contain are dropped as typed.
 */
export function CodeInput({ value, onChange, onComplete, error }: Props) {
  const ref = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);

  function set(raw: string) {
    const clean = (raw.toUpperCase().match(ALLOWED) ?? []).join("").slice(0, CODE_LENGTH);
    onChange(clean);
    if (clean.length === CODE_LENGTH && clean !== value) onComplete?.(clean);
  }

  return (
    <View style={styles.wrap}>
      <Text variant="label" aria-hidden>
        Company code
      </Text>
      <Pressable onPress={() => ref.current?.focus()} style={styles.cells} accessible={false}>
        {Array.from({ length: CODE_LENGTH }, (_, i) => {
          const active = focused && i === Math.min(value.length, CODE_LENGTH - 1);
          return (
            <View
              key={i}
              style={[
                styles.cell,
                !!value[i] && styles.filled,
                active && styles.active,
                !!error && styles.err,
                i === 2 && styles.gap,
              ]}
            >
              <Text style={styles.char}>{value[i] ?? ""}</Text>
            </View>
          );
        })}
        <TextInput
          ref={ref}
          value={value}
          onChangeText={set}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoCapitalize="characters"
          autoCorrect={false}
          autoComplete="off"
          maxLength={CODE_LENGTH + 2}
          accessibilityLabel="Company code, 6 characters"
          style={styles.hidden}
          caretHidden
        />
      </Pressable>
      {error ? (
        <Text variant="caption" tone="missed" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : (
        <Text variant="caption" tone="tertiary">
          Six letters and numbers. Your manager can see it on their Home screen.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  cells: { flexDirection: "row", gap: 8, position: "relative" },
  cell: {
    flex: 1,
    maxWidth: 56,
    aspectRatio: 0.82,
    borderWidth: 1,
    borderColor: palette.ruleStrong,
    borderRadius: radius.md,
    backgroundColor: palette.card,
    alignItems: "center",
    justifyContent: "center",
  },
  gap: { marginRight: 10 },
  filled: { borderColor: palette.ink },
  active: { borderColor: palette.ink, borderWidth: 2, backgroundColor: palette.markerSoft },
  err: { borderColor: palette.missed },
  char: { fontFamily: fonts.monoMedium, fontSize: 24, color: palette.ink },
  hidden: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.011,
    color: "transparent",
    fontSize: 1,
  },
});
