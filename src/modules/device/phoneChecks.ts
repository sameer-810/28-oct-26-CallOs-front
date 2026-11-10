/**
 * The phone's setup checklist — pure, so the rules are unit-tested
 * (tests/androidParity.test.ts) and the same list feeds the screen, the
 * header badge and the manager's view of the phone.
 */
import type { Health, Permissions, SettingScreen } from "@/modules/call-tracker";

export type CheckKey =
  | "callLog"
  | "recordings"
  | "contacts"
  | "notifications"
  | "battery"
  | "overlay"
  | "autostart"
  | "recordingFolder";

/** How a check is fixed: a runtime permission, a system screen, the folder picker, or "I've done this". */
export type Fix =
  | { kind: "permission"; permissions: ("callLog" | "recordings" | "contacts" | "notifications")[] }
  | { kind: "setting"; screen: SettingScreen; confirm?: boolean }
  | { kind: "folder" };

export interface CheckItem {
  key: CheckKey;
  title: string;
  why: string;
  ok: boolean;
  /** A warning, not a failure: calls still sync without it. */
  soft: boolean;
  fix: Fix;
}

export interface Remembered {
  /** The rep said they switched auto-start on (Android can't tell us). */
  autostartConfirmed: boolean;
  /** Recordings were already found without a picked folder. */
  recordingFolderSeen: boolean;
}

export function phoneChecks(p: Permissions, h: Health, r: Remembered) {
  const items: CheckItem[] = [
    {
      key: "callLog",
      title: "Phone & call logs",
      why: "Read your call log so calls sync to your account.",
      ok: p.callLog && p.phoneState,
      soft: false,
      fix: { kind: "permission", permissions: ["callLog"] },
    },
    {
      key: "recordings",
      title: "Call-recording access",
      why: "Read the phone's call-recording files so recordings attach to calls.",
      ok: p.recordings,
      soft: false,
      fix: { kind: "permission", permissions: ["recordings"] },
    },
    {
      key: "contacts",
      title: "Contacts",
      why: "Show caller names on your call logs.",
      ok: p.contacts,
      soft: true,
      fix: { kind: "permission", permissions: ["contacts"] },
    },
    {
      key: "notifications",
      title: "Notifications",
      why: "Follow-up reminders, and alerts about sync and recordings.",
      ok: p.notifications,
      soft: false,
      fix: { kind: "permission", permissions: ["notifications"] },
    },
    {
      key: "battery",
      title: "Background battery access",
      why: "Keep syncing calls when the app is in the background. Without it, sync stops when the screen is off.",
      ok: h.battery,
      soft: true,
      fix: { kind: "setting", screen: "battery" },
    },
    {
      key: "overlay",
      title: "Display over other apps",
      why: "Opens the after-call sheet the moment a call ends.",
      ok: h.overlay,
      soft: true,
      fix: { kind: "setting", screen: "overlay" },
    },
    {
      key: "autostart",
      title: "Auto-start",
      why: h.autostartNeeded
        ? "Let the app start in the background so calls sync reliably. Find Ringwise in the list and switch it on."
        : "Not required on this phone.",
      ok: !h.autostartNeeded || r.autostartConfirmed,
      soft: true,
      fix: { kind: "setting", screen: "autostart", confirm: true },
    },
    {
      key: "recordingFolder",
      title: "Recording folder",
      why: "Pick the folder where your phone saves call recordings.",
      ok: h.recordingFolder || r.recordingFolderSeen,
      soft: true,
      fix: { kind: "folder" },
    },
  ];
  const passing = items.filter((i) => i.ok).length;
  return {
    items,
    passing,
    total: items.length,
    /** Hard failures: calls or recordings are not arriving. */
    blocking: items.filter((i) => !i.ok && !i.soft).length,
    /** What the server keeps for the manager. */
    report: {
      ...(Object.fromEntries(items.map((i) => [i.key, i.ok])) as Record<CheckKey, boolean>),
      whatsapp: h.whatsapp,
    },
  };
}
