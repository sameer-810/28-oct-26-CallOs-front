import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo";

export interface Sim {
  slot: number;
  subscriptionId: number;
  carrier: string;
  displayName: string;
  /** Often null: many SIMs don't expose their number to apps. */
  number: string | null;
}

/** A raw Android call-log row. `type` is CallLog.Calls.TYPE. */
export interface CallLogRow {
  id: string;
  number: string;
  type: number;
  date: number;
  duration: number;
  name: string;
  phoneAccountId: string;
  simSlot: number | null;
}

export interface FoundRecording {
  uri: string;
  name: string;
  folder: string;
  bytes: number;
  mime: string;
  durationSec: number;
  score: number;
}

export interface Permissions {
  callLog: boolean;
  phoneState: boolean;
  phoneNumbers: boolean;
  recordings: boolean;
  notifications: boolean;
  contacts: boolean;
  callPhone: boolean;
}

/** Phone settings that aren't runtime permissions. */
export interface Health {
  /** Left out of battery optimisation. */
  battery: boolean;
  /** "Display over other apps": the after-call sheet opens by itself. */
  overlay: boolean;
  /** Notification access, which WhatsApp call logging needs. */
  whatsapp: boolean;
  /** This brand has an auto-start switch the rep must turn on by hand. */
  autostartNeeded: boolean;
  /** A recording folder is picked and still readable. */
  recordingFolder: boolean;
  power: { level: number | null; charging: boolean; powerSave: boolean };
}

/** "app": the app's own settings page, where a denied permission can still be granted. */
export type SettingScreen = "battery" | "overlay" | "whatsapp" | "autostart" | "notifications" | "defaultDialer" | "app";

export interface PickedFolder {
  uri: string;
  /** e.g. "Recordings/Call" */
  label: string;
  readable: boolean;
}

/** A finished WhatsApp call, as the notification listener saw it. */
export interface WhatsAppCall {
  id: string;
  type: "incoming" | "outgoing" | "missed";
  video: boolean;
  title: string;
  /** From the title, or the contact saved under that name; null when neither. */
  number: string | null;
  name: string;
  startedAt: number;
  durationSec: number;
}

export interface FollowupAlarm {
  /** The call id: tapping the reminder opens that call. */
  id: string;
  at: number;
  title: string;
  text: string;
  phone: string;
}

export interface SharedAudio {
  uri: string;
  name: string;
  mime: string;
  bytes: number;
}

interface CallTrackerNative {
  getDeviceInfo(): { brand: string; manufacturer: string; model: string; androidVersion: string; sdkInt: number };
  getPermissions(): Permissions;
  getSims(): Sim[];
  readCallLog(sinceMs: number, limit: number): Promise<CallLogRow[]>;
  findRecording(number: string, startedAtMs: number, durationSec: number, contactName: string | null): Promise<FoundRecording | null>;
  copyToCache(uri: string, fileName: string): Promise<string>;
  setAfterCallPrompt(enabled: boolean): void;
  lastCallEndedAt(): number;
  getHealth(): Health;
  openSetting(what: SettingScreen): boolean;
  getRecordingFolder(): PickedFolder | null;
  pickRecordingFolder(): Promise<PickedFolder | null>;
  pendingWhatsAppCalls(): WhatsAppCall[];
  ackWhatsAppCalls(ids: string[]): void;
  setFollowups(list: FollowupAlarm[]): number;
  /** true: rang out directly; false: opened the dialler. */
  placeCall(number: string, simSlot: number | null): boolean;
  takeSharedAudio(): SharedAudio | null;
  /** The background-sync service and its ongoing notification; false if Android refused. */
  startSyncService(text: string | null): boolean;
  stopSyncService(): void;
  updateSyncNotice(text: string): void;
  /** A notification of the app's own. `url` opens on tap (callos://…). */
  notify(kind: "coaching" | "setup", id: number, title: string, text: string, url: string | null): void;
  addListener(event: "onSharedAudio", fn: (a: SharedAudio) => void): { remove(): void };
  addListener(event: "onCallEnded", fn: (e: { at: number }) => void): { remove(): void };
}

/**
 * The native call tracker, or null where it can't exist (web, iOS, Expo Go).
 * Callers check for null and show "install the Android app" instead.
 */
export const CallTracker: CallTrackerNative | null =
  Platform.OS === "android" ? requireOptionalNativeModule<CallTrackerNative>("CallTracker") : null;
