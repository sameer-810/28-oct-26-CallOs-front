import type { ComponentType } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { createBottomTabNavigator, type BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import DashboardScreen from "@modules/dashboard/screens/DashboardScreen";
import CallsScreen from "@modules/calls/screens/CallsScreen";
import OpportunitiesScreen from "@modules/opportunities/screens/OpportunitiesScreen";
import ReportsScreen from "@modules/reports/screens/ReportsScreen";
import TeamScreen from "@modules/team/screens/TeamScreen";
import SettingsScreen from "@modules/settings/screens/SettingsScreen";
import AccountScreen from "@modules/account/screens/AccountScreen";
import MoreScreen from "@modules/more/screens/MoreScreen";
import AgentScreen from "@modules/agent/screens/AgentScreen";
import InboxScreen from "@modules/inbox/screens/InboxScreen";
import PlaybookScreen from "@modules/playbook/screens/PlaybookScreen";
import BillingScreen from "@modules/billing/screens/BillingScreen";
import { PlanEnded } from "@modules/billing/components/PlanEnded";
import { useUnreadCount } from "@modules/inbox/hooks/useInbox";
import { useMe } from "@modules/auth/hooks/useAuth";
import { useForegroundSync } from "@modules/device/useForegroundSync";
import { CallBar } from "@modules/telephony/components/CallBar";
import { useAuthStore } from "@shared/store/useAuthStore";
import { environment } from "@config/env";
import { fonts, palette, space } from "@shared/designSystem";
import { Icon, Text, useBreakpoint, type IconName, type PressState } from "@shared/ui";
import { Brand } from "@shared/ui/BrandMark";
import { ConnectCode } from "@modules/company/components/ConnectCode";
import { navItemsFor } from "./navItems";
import type { AppTabParamList } from "./types";

const Tab = createBottomTabNavigator<AppTabParamList>();

// each screen types its own route props
const SCREENS: Record<keyof AppTabParamList, ComponentType<any>> = {
  Home: DashboardScreen,
  Calls: CallsScreen,
  Opportunities: OpportunitiesScreen,
  Reports: ReportsScreen,
  Agent: AgentScreen,
  Inbox: InboxScreen,
  Playbook: PlaybookScreen,
  Billing: BillingScreen,
  Team: TeamScreen,
  Settings: SettingsScreen,
  Account: AccountScreen,
  More: MoreScreen,
};

/**
 * Sidebar on a laptop, tab bar on a phone — one component reading one list,
 * so they can't disagree. The phone shows the primary four and "More".
 */
function NavBar({ state, navigation }: BottomTabBarProps) {
  const { isWide } = useBreakpoint();
  const insets = useSafeAreaInsets();
  const company = useAuthStore((s) => s.company);
  const user = useAuthStore((s) => s.user);
  const allowed = navItemsFor(user?.role);
  const current = state.routes[state.index]?.name;
  const unread = useUnreadCount().data ?? 0;

  const entries: { name: keyof AppTabParamList; label: string; icon: IconName }[] = isWide
    ? allowed
    : [...allowed.filter((i) => i.primary), { name: "More", label: "More", icon: "more" }];
  const secondary = new Set(allowed.filter((i) => !i.primary).map((i) => i.name as string));

  const items = entries.map((item) => {
    const route = state.routes.find((r) => r.name === item.name);
    if (!route) return null;
    // the inbox count, on Inbox itself or on the More that holds it
    const badge = unread > 0 && (item.name === "Inbox" || (!isWide && item.name === "More" && secondary.has("Inbox"))) ? unread : 0;
    // on a phone, Team / Settings / Account light up "More"
    const focused = current === item.name || (!isWide && item.name === "More" && secondary.has(current ?? ""));
    const go = () => {
      const e = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
      if (!e.defaultPrevented) navigation.navigate(route.name);
    };
    return (
      <Pressable
        key={route.key}
        accessibilityRole={isWide ? "link" : "tab"}
        aria-selected={isWide ? undefined : focused}
        aria-current={isWide && focused ? "page" : undefined}
        accessibilityLabel={badge ? `${item.label}, ${badge} unread` : item.label}
        onPress={go}
        style={({ hovered }: PressState) => [
          isWide ? styles.sideItem : styles.tabItem,
          isWide && focused && styles.sideItemOn,
          isWide && hovered && !focused && styles.sideItemHover,
        ]}
      >
        <Icon name={item.icon} size={isWide ? 18 : 22} color={focused ? palette.ink : palette.ink3} />
        <Text style={[isWide ? styles.sideLabel : styles.tabLabel, focused && styles.labelOn]} numberOfLines={1}>
          {item.label}
        </Text>
        {badge ? (
          <View style={isWide ? styles.badgeSide : styles.badgeTab}>
            <Text style={styles.badgeText}>{badge > 99 ? "99+" : badge}</Text>
          </View>
        ) : null}
        {!isWide && focused ? <View style={styles.tabMark} /> : null}
      </Pressable>
    );
  });

  if (isWide) {
    return (
      <View style={[styles.side, { paddingTop: insets.top + space.xl }]}>
        <View style={styles.sideBrand}>
          <Brand />
        </View>
        <View style={styles.sideCode}>
          <ConnectCode />
        </View>
        <View style={styles.sideNav}>{items}</View>
        <View style={styles.sideFoot}>
          <Text variant="label" numberOfLines={1}>
            {user?.name}
          </Text>
          <Text variant="caption" tone="tertiary" numberOfLines={1}>
            {company?.name}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.tabs, { paddingBottom: Math.max(insets.bottom, space.sm) }]} accessibilityRole="tablist">
      {items}
    </View>
  );
}

export default function AppNavigator() {
  const role = useAuthStore((s) => s.user?.role);
  const { isWide } = useBreakpoint();
  useMe();
  useForegroundSync();

  const expired = useAuthStore((s) => s.company?.subscription?.status === "expired");
  if (expired) return <PlanEnded />;

  const routes = [...navItemsFor(role).map((i) => ({ name: i.name, label: i.label })), { name: "More" as const, label: "More" }];

  return (
    <View style={{ flex: 1 }}>
    <Tab.Navigator
      tabBar={(props) => <NavBar {...props} />}
      screenOptions={{ headerShown: false, tabBarPosition: isWide ? "left" : "bottom" }}
    >
      {routes.map((r) => (
        <Tab.Screen key={r.name} name={r.name} component={SCREENS[r.name]} options={{ title: `${r.label} · ${environment.appName}` }} />
      ))}
    </Tab.Navigator>
      {/* the live browser call floats over every screen */}
      {Platform.OS === "web" ? <CallBar /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  side: {
    width: 232,
    backgroundColor: palette.paper2,
    borderRightWidth: 1,
    borderRightColor: palette.rule,
    paddingHorizontal: space.md,
    paddingBottom: space.lg,
  },
  sideBrand: { paddingHorizontal: space.sm, marginBottom: space.lg },
  sideCode: { marginBottom: space.xl },
  sideNav: { gap: 2, flex: 1 },
  sideItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.sm + 2,
    paddingVertical: 10,
    borderRadius: 6,
  },
  sideItemOn: { backgroundColor: palette.card, borderWidth: 1, borderColor: palette.ruleStrong, paddingVertical: 9 },
  sideItemHover: { backgroundColor: "rgba(255,255,255,0.45)" },
  sideLabel: { fontFamily: fonts.textMedium, fontSize: 14, color: palette.ink2, flex: 1 },
  badgeSide: { minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 10, backgroundColor: palette.marker, alignItems: "center", justifyContent: "center" },
  badgeTab: { position: "absolute", top: 0, left: "54%", minWidth: 17, height: 17, paddingHorizontal: 4, borderRadius: 9, backgroundColor: palette.marker, borderWidth: 1.5, borderColor: palette.card, alignItems: "center", justifyContent: "center" },
  badgeText: { fontFamily: fonts.monoMedium, fontSize: 10.5, color: palette.ink },
  labelOn: { color: palette.ink },
  sideFoot: { borderTopWidth: 1, borderTopColor: palette.rule, paddingTop: space.md, paddingHorizontal: space.sm, gap: 2 },
  tabs: {
    flexDirection: "row",
    backgroundColor: palette.card,
    borderTopWidth: 1,
    borderTopColor: palette.rule,
    paddingTop: space.sm,
  },
  tabItem: { flex: 1, alignItems: "center", gap: 3, paddingVertical: 4, position: "relative" },
  tabLabel: { fontFamily: fonts.textMedium, fontSize: 10.5, color: palette.ink3 },
  tabMark: {
    position: "absolute",
    top: -space.sm - 1,
    width: 28,
    height: 2,
    backgroundColor: palette.ink,
  },
});
