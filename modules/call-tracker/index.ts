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
}

/**
 * The native call tracker, or null where it can't exist (web, iOS, Expo Go).
 * Callers check for null and show "install the Android app" instead.
 */
export const CallTracker: CallTrackerNative | null =
  Platform.OS === "android" ? requireOptionalNativeModule<CallTrackerNative>("CallTracker") : null;
