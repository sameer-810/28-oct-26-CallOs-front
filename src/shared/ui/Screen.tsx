import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { PAGE_MAX, palette, space } from "../designSystem";

interface Props {
  children: ReactNode;
  /** Narrow column for forms. */
  maxWidth?: number;
  /** Pinned under the scroll area, e.g. a primary action. */
  footer?: ReactNode;
  scroll?: boolean;
}

/** Safe area, keyboard avoidance, page background and a centred column. */
export function Screen({ children, maxWidth = PAGE_MAX, footer, scroll = true }: Props) {
  const column = <View style={[styles.column, { maxWidth }]}>{children}</View>;
  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {scroll ? (
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            {column}
          </ScrollView>
        ) : (
          <View style={[styles.content, styles.flex]}>{column}</View>
        )}
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.paper },
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: space.lg,
    paddingTop: space.xl,
    paddingBottom: space.xxxl,
    alignItems: "center",
  },
  column: { width: "100%" },
  footer: {
    borderTopWidth: 1,
    borderTopColor: palette.rule,
    padding: space.lg,
    backgroundColor: palette.paper,
  },
});
