import type { NavigatorScreenParams } from "@react-navigation/native";

export type AuthStackParamList = {
  SignIn: undefined;
  SignUp: undefined;
  /** `code` pre-fills the boxes, from a shared join link. */
  Join: { code?: string } | undefined;
};

export type AppTabParamList = {
  Home: undefined;
  /**
   * `afterCall` set: a call just ended — sync, then open it.
   * `open`: a call id from a notification, `at` seconds into it, `c` the comment.
   */
  Calls: { afterCall?: string; open?: string; at?: string; c?: string } | undefined;
  Inbox: undefined;
  Playbook: { tab?: "script" | "whatsapp" } | undefined;
  Opportunities: undefined;
  /** `tab` opens a particular report — dashboard tiles pass it. */
  Reports: { tab?: string } | undefined;
  Agent: undefined;
  /** `invoice`: back from the payment page. */
  Billing: { invoice?: string } | undefined;
  Team: undefined;
  Settings: undefined;
  Account: undefined;
  /** Phone only: the destinations that don't fit in the tab bar. */
  More: undefined;
};

export type RootParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  App: NavigatorScreenParams<AppTabParamList>;
  DeviceSetup: undefined;
};
