import { forwardRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { fonts, palette, radius } from "../designSystem";
import { Text } from "./Text";

interface Props extends Omit<TextInputProps, "style"> {
  label: string;
  error?: string;
  hint?: string;
  /** Show a Show/Hide control for passwords. */
  secureToggle?: boolean;
  /** Fixed text before the input, e.g. "+91". */
  prefix?: string;
}

export const TextField = forwardRef<TextInput, Props>(function TextField(
  { label, error, hint, secureToggle, prefix, secureTextEntry, onFocus, onBlur, ...rest },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);
  const secure = secureToggle ? hidden : secureTextEntry;

  return (
    <View style={styles.wrap}>
      <Text variant="label" style={styles.label} nativeID={`${label}-label`}>
        {label}
      </Text>
      <View
        style={[
          styles.box,
          focused && styles.boxFocused,
          !!error && styles.boxError,
        ]}
      >
        {prefix ? (
          <Text variant="mono" tone="secondary" style={styles.prefix}>
            {prefix}
          </Text>
        ) : null}
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          aria-labelledby={`${label}-label`}
          placeholderTextColor={palette.ink3}
          secureTextEntry={secure}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={styles.input}
          {...rest}
        />
        {secureToggle ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hidden ? "Show password" : "Hide password"}
            onPress={() => setHidden((h) => !h)}
            style={styles.toggle}
            hitSlop={8}
          >
            <Text variant="label" tone="secondary">
              {hidden ? "Show" : "Hide"}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text variant="caption" tone="missed" accessibilityLiveRegion="polite" style={styles.msg}>
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" tone="tertiary" style={styles.msg}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { color: palette.ink },
  box: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 50,
    borderWidth: 1,
    borderColor: palette.ruleStrong,
    borderRadius: radius.md,
    backgroundColor: palette.card,
    paddingHorizontal: 14,
  },
  boxFocused: { borderColor: palette.ink, borderWidth: 1.5, paddingHorizontal: 13.5 },
  boxError: { borderColor: palette.missed },
  prefix: { marginRight: 8, fontSize: 15 },
  input: {
    flex: 1,
    fontFamily: fonts.text,
    fontSize: 16,
    color: palette.ink,
    paddingVertical: 12,
    // the box draws the focus ring on web
    outlineStyle: "none",
  } as object,
  toggle: { paddingLeft: 10, paddingVertical: 6 },
  msg: { marginTop: 1 },
});
