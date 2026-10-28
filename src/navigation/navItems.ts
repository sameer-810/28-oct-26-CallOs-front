import type { Role } from "@modules/auth/types";
import type { IconName } from "@shared/ui";
import type { AppTabParamList } from "./types";

export interface NavItem {
  name: Exclude<keyof AppTabParamList, "More">;
  label: string;
  icon: IconName;
  roles: Role[];
  /** In the phone's tab bar; the rest go under More. */
  primary: boolean;
}

/**
 * The single list the sidebar, the tab bar, the More screen and route
 * registration all read. A screen a role can't use is never registered, so a
 * deep link can't reach it.
 */
export const NAV_ITEMS: NavItem[] = [
  { name: "Home", label: "Home", icon: "home", roles: ["owner", "manager", "rep"], primary: true },
  { name: "Calls", label: "Calls", icon: "calls", roles: ["owner", "manager", "rep"], primary: true },
  { name: "Opportunities", label: "Opportunities", icon: "spark", roles: ["owner", "manager", "rep"], primary: true },
  { name: "Reports", label: "Reports", icon: "chart", roles: ["owner", "manager"], primary: true },
  { name: "Inbox", label: "Inbox", icon: "bell", roles: ["owner", "manager", "rep"], primary: false },
  { name: "Playbook", label: "Scripts", icon: "book", roles: ["owner", "manager", "rep"], primary: false },
  { name: "Agent", label: "AI agent", icon: "agent", roles: ["owner", "manager"], primary: false },
  { name: "Team", label: "Team", icon: "team", roles: ["owner", "manager"], primary: false },
  { name: "Settings", label: "Settings", icon: "settings", roles: ["owner", "manager"], primary: false },
  { name: "Billing", label: "Billing", icon: "card", roles: ["owner"], primary: false },
  { name: "Account", label: "Account", icon: "account", roles: ["owner", "manager", "rep"], primary: false },
];

export function navItemsFor(role: Role | undefined) {
  return role ? NAV_ITEMS.filter((i) => i.roles.includes(role)) : [];
}
