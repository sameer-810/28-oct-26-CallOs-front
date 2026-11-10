export type CheckName =
  | "callLog"
  | "recordings"
  | "contacts"
  | "notifications"
  | "battery"
  | "overlay"
  | "autostart"
  | "recordingFolder"
  | "whatsapp";

/** A rep's phone as the manager's Team screen sees it. */
export interface DeviceInfo {
  id: string;
  userId: string;
  name: string;
  brand: string;
  model: string;
  androidVersion: string;
  simLabel: string;
  simVerified: boolean;
  permissions: { callLog: boolean; phoneState: boolean; recordings: boolean; notifications: boolean };
  recordingFolder: string;
  sims: { slot: number; carrier: string; number: string | null; verifiedAt: string | null }[];
  checks: Record<CheckName, boolean> | null;
  battery: { level: number | null; charging: boolean | null; powerSave: boolean | null; at: string } | null;
  appVersion: string;
  lastSyncAt: string | null;
  lastCallAt: string | null;
}

/** The phone's own report of itself, sent after setup and on every sync. */
export interface DeviceReport {
  deviceId: string;
  brand: string;
  model: string;
  androidVersion: string;
  appVersion: string;
  permissions: { callLog: boolean; phoneState: boolean; recordings: boolean; notifications: boolean };
  simSlot?: number;
  simLabel?: string;
  simNumber?: string | null;
  simConfirmed?: boolean;
  recordingFolder?: string;
  sims?: { slot: number; carrier: string; number: string | null; verified: boolean }[];
  checks?: Record<CheckName, boolean>;
  battery?: { level: number | null; charging: boolean | null; powerSave: boolean | null };
}

/** What the server made of one batch: each call's id, and whether it still wants the recording. */
export interface BatchResult {
  inserted: number;
  calls: { clientCallId: string; id: string; recording: string }[];
}

export interface SyncResult {
  ran: boolean;
  sent: number;
  inserted: number;
  recordings: number;
  reason?: string;
}
