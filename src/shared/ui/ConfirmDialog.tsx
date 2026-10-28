import { Modal, Pressable, StyleSheet, View } from "react-native";
import { FORM_MAX, palette, radius, space } from "../designSystem";
import { Button } from "./Button";
import { Text } from "./Text";

interface Props {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** In-app confirmation. `window.confirm` is unstyled on web and absent on native. */
export function ConfirmDialog({ visible, title, message, confirmLabel, danger, loading, onConfirm, onCancel }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.scrim} onPress={onCancel} accessibilityLabel="Close">
        <Pressable style={styles.sheet} accessibilityViewIsModal onPress={() => {}}>
          <Text variant="title" style={styles.title}>
            {title}
          </Text>
          <Text tone="secondary">{message}</Text>
          <View style={styles.actions}>
            <Button label="Cancel" kind="ghost" onPress={onCancel} style={styles.btn} />
            <Button
              label={confirmLabel}
              kind={danger ? "danger" : "primary"}
              onPress={onConfirm}
              loading={loading}
              style={styles.btn}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: "rgba(23, 20, 15, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: space.lg,
  },
  sheet: {
    width: "100%",
    maxWidth: FORM_MAX,
    backgroundColor: palette.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: palette.ink,
    padding: space.xl,
    gap: space.md,
  },
  title: { fontSize: 24, lineHeight: 28 },
  actions: { flexDirection: "row", gap: space.sm, marginTop: space.md },
  btn: { flex: 1 },
});
