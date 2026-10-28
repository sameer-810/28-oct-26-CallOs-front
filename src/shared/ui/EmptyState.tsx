import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { palette, space } from "../designSystem";
import { Icon, type IconName } from "./Icon";
import { Text } from "./Text";

/** Says what's missing and what to do about it — never just "No data available". */
export function EmptyState({ icon = "calls", title, body, action }: { icon?: IconName; title: string; body: string; action?: ReactNode }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.icon}>
        <Icon name={icon} size={20} />
      </View>
      <Text variant="heading" align="center">
        {title}
      </Text>
      <Text variant="caption" tone="secondary" align="center" style={styles.body}>
        {body}
      </Text>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", paddingVertical: space.xxl, paddingHorizontal: space.lg, gap: space.sm },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: palette.ruleStrong,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: space.xs,
  },
  body: { maxWidth: 340 },
});
