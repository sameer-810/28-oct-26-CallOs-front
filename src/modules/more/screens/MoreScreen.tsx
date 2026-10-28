import { Pressable, StyleSheet, View } from "react-native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { AppTabParamList } from "@navigation/types";
import { navItemsFor } from "@navigation/navItems";
import { useUnreadCount } from "@modules/inbox/hooks/useInbox";
import { ConnectCode } from "@modules/company/components/ConnectCode";
import { useAuthStore } from "@shared/store/useAuthStore";
import { fonts, palette, space } from "@shared/designSystem";
import { Card, Icon, Screen, Text, type PressState } from "@shared/ui";

type Props = BottomTabScreenProps<AppTabParamList, "More">;

/** Phone only: everything that doesn't fit in the four-tab bar. */
export default function MoreScreen({ navigation }: Props) {
  const role = useAuthStore((s) => s.user?.role);
  const company = useAuthStore((s) => s.company);
  const user = useAuthStore((s) => s.user);
  const items = navItemsFor(role).filter((i) => !i.primary);
  const unread = useUnreadCount().data ?? 0;

  return (
    <Screen>
      <Text variant="eyebrow" tone="tertiary">
        {company?.name}
      </Text>
      <Text variant="display" style={{ marginTop: 6 }}>
        More
      </Text>
      <View style={{ marginTop: space.lg }}>
        <ConnectCode />
      </View>
      <Card padded={false} style={{ marginTop: space.lg }}>
        {items.map((it, i) => (
          <Pressable
            key={it.name}
            accessibilityRole="link"
            onPress={() => navigation.navigate(it.name)}
            style={({ pressed }: PressState) => [styles.row, i === items.length - 1 && { borderBottomWidth: 0 }, pressed && { backgroundColor: palette.paper }]}
          >
            <Icon name={it.icon} />
            <Text variant="bodyMedium" style={{ flex: 1 }}>
              {it.label}
            </Text>
            {it.name === "Inbox" && unread ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unread}</Text>
              </View>
            ) : null}
            <Text tone="tertiary">›</Text>
          </Pressable>
        ))}
      </Card>
      <View style={styles.who}>
        <Text variant="label">{user?.name}</Text>
        <Text variant="caption" tone="tertiary">
          Signed in as {user?.role}
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.lg, borderBottomWidth: 1, borderBottomColor: palette.rule },
  badge: { minWidth: 22, height: 22, paddingHorizontal: 6, borderRadius: 11, backgroundColor: palette.marker, alignItems: "center", justifyContent: "center" },
  badgeText: { fontFamily: fonts.monoMedium, fontSize: 11.5, color: palette.ink },
  who: { marginTop: space.xl, alignItems: "center", gap: 2 },
});
