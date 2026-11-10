import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { secureStorage } from "@shared/store/useAuthStore";

const MAX_LINES = 150;

interface SyncLogState {
  lines: string[];
  add: (line: string) => void;
  clear: () => void;
}

/**
 * What the phone did and when: syncs, uploads, failures. Sent to support from
 * Settings → "Send log file", so "my calls aren't showing" can be answered
 * from the phone's own record instead of a description of it. Holds no
 * numbers or names — only counts and errors.
 */
export const useSyncLog = create<SyncLogState>()(
  persist(
    (set) => ({
      lines: [],
      add: (line) =>
        set((s) => ({ lines: [...s.lines, `${new Date().toISOString()} ${line.slice(0, 200)}`].slice(-MAX_LINES) })),
      clear: () => set({ lines: [] }),
    }),
    { name: "callos-sync-log", storage: createJSONStorage(() => secureStorage) },
  ),
);

export const logSync = (line: string) => useSyncLog.getState().add(line);
