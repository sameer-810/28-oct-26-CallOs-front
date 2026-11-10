import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { secureStorage } from "@shared/store/useAuthStore";
import type { WorkSim } from "./syncRules";

/** A call whose recording hasn't been found yet — dialers sometimes write the file late. */
export interface PendingRecording {
  callId: string;
  phone: string;
  contactName: string;
  startedAt: string;
  durationSec: number;
  attempts: number;
}

interface DeviceState {
  setupDone: boolean;
  /** "Not now" on the setup screen: don't ask again on every launch. */
  setupSkipped: boolean;
  workSlot: number | null;
  simLabel: string;
  simCount: number;
  simConfirmed: boolean;
  /** Newest call-log row already read, ms since epoch. */
  watermark: number | null;
  pending: PendingRecording[];
  lastSyncAt: number | null;
  lastError: string | null;
  recordingFolder: string;
  /** The work SIMs set up on this phone (callos-style: each with its number, proved by a test call). */
  sims: WorkSim[];
  /** The rep said auto-start is on: Android can't report it. */
  autostartConfirmed: boolean;
  /** A recording was already found without a picked folder. */
  recordingFolderSeen: boolean;
  /** The set-up SIMs are no longer all in the phone. */
  simChanged: boolean;
  /** Follow-up reminders armed on the phone after the last sync. */
  alarms: number;

  set: (patch: Partial<Omit<DeviceState, "set" | "reset">>) => void;
  reset: () => void;
}

const initial = {
  setupDone: false,
  setupSkipped: false,
  workSlot: null,
  simLabel: "",
  simCount: 0,
  simConfirmed: false,
  watermark: null,
  pending: [],
  lastSyncAt: null,
  lastError: null,
  recordingFolder: "",
  sims: [] as WorkSim[],
  autostartConfirmed: false,
  recordingFolderSeen: false,
  simChanged: false,
  alarms: 0,
};

/** What this phone has set up for call tracking. Per install, cleared on sign-out. */
export const useDeviceStore = create<DeviceState>()(
  persist(
    (set) => ({
      ...initial,
      set: (patch) => set(patch),
      reset: () => set(initial),
    }),
    { name: "callos-device", storage: createJSONStorage(() => secureStorage) },
  ),
);
