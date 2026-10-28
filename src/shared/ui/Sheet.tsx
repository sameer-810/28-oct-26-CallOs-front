import type { ReactNode } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { palette, radius, space } from "../designSystem";
import { Text } from "./Text";
import { useBreakpoint } from "./useBreakpoint";

interface Props {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * A bottom sheet on a phone, a right-hand panel on a laptop. Same content,
 * placed where a thumb or a mouse expects it.
 */
export function Sheet({ visible, onClose, title, children, footer }: Props) {
  const { isWide } = useBreakpoint();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType={isWide ? "fade" : "slide"} onRequestClose={onClose}>
      <View style={[styles.wrap, isWide ? styles.wrapWide : styles.wrapNarrow]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <View
          accessibilityViewIsModal
          style={[isWide ? styles.panel : styles.sheet, { paddingBottom: Math.max(insets.bottom, space.lg) }]}
        >
          <View style={styles.head}>
            <Text variant="title" style={styles.title} numberOfLines={2}>
              {title}
            </Text>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={10} style={styles.close}>
              <Text variant="label" tone="secondary">
                Close
              </Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "rgba(23, 20, 15, 0.4)" },
  wrapWide: { flexDirection: "row", justifyContent: "flex-end" },
  wrapNarrow: { justifyContent: "flex-end" },
  panel: {
    width: 460,
    maxWidth: "100%",
    height: "100%",
    backgroundColor: palette.card,
    borderLeftWidth: 1,
    borderLeftColor: palette.ink,
  },
  sheet: {
    maxHeight: "92%",
    backgroundColor: palette.card,
    borderTopLeftRadius: radius.xl + 4,
    borderTopRightRadius: radius.xl + 4,
    borderTopWidth: 1,
    borderColor: palette.ink,
  },
  head: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.md,
    paddingHorizontal: space.xl,
    paddingTop: space.xl,
    paddingBottom: space.md,
    borderBottomWidth: 1,
    borderBottomColor: palette.rule,
  },
  title: { flex: 1, fontSize: 24, lineHeight: 28 },
  close: { paddingTop: 6 },
  body: { padding: space.xl, gap: space.lg },
  footer: { paddingHorizontal: space.xl, paddingTop: space.md, borderTopWidth: 1, borderTopColor: palette.rule },
});
