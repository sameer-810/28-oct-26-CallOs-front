import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { secureStorage } from "@shared/store/useAuthStore";
import type { CallColumn, PageSize } from "./types";

export const DEFAULT_COLUMNS: CallColumn[] = ["date", "type", "phone", "contact", "employee", "duration", "recording", "status", "followUp", "deal"];

interface CallsView {
  view: "list" | "table";
  columns: CallColumn[];
  pageSize: PageSize;
  setView: (v: "list" | "table") => void;
  toggleColumn: (c: CallColumn) => void;
  setPageSize: (n: PageSize) => void;
  resetColumns: () => void;
}

/**
 * How this person likes the call log laid out — list or table, which columns,
 * how many a page. Kept on this device: a manager's laptop table and a rep's
 * phone list are different habits, not one account setting.
 */
export const useCallsView = create<CallsView>()(
  persist(
    (set) => ({
      view: "list",
      columns: DEFAULT_COLUMNS,
      pageSize: 50,
      setView: (view) => set({ view }),
      toggleColumn: (c) => set((s) => ({ columns: s.columns.includes(c) ? s.columns.filter((x) => x !== c) : [...s.columns, c] })),
      setPageSize: (pageSize) => set({ pageSize }),
      resetColumns: () => set({ columns: DEFAULT_COLUMNS }),
    }),
    { name: "callos-calls-view", storage: createJSONStorage(() => secureStorage) },
  ),
);
