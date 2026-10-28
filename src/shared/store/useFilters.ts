import { create } from "zustand";

export type RangeName = "today" | "yesterday" | "last7" | "this_week" | "last_week" | "last30" | "this_month" | "custom";

export const RANGE_LABEL: Record<RangeName, string> = {
  today: "Today",
  yesterday: "Yesterday",
  last7: "7 days",
  this_week: "This week",
  last_week: "Last week",
  last30: "30 days",
  this_month: "This month",
  custom: "Custom",
};

interface Filters {
  range: RangeName;
  from?: string;
  to?: string;
  /** Empty = everyone. Ignored by the API for reps. */
  userIds: string[];
  excludeNumbers: boolean;
  setRange: (range: RangeName, from?: string, to?: string) => void;
  setUserIds: (ids: string[]) => void;
  setExcludeNumbers: (v: boolean) => void;
  reset: () => void;
}

/**
 * One range and one set of people for the whole app: pick "Last week" on the
 * dashboard and the call log and reports are already on last week.
 */
export const useFilters = create<Filters>((set) => ({
  range: "today",
  userIds: [],
  excludeNumbers: true,
  setRange: (range, from, to) => set({ range, from, to }),
  setUserIds: (userIds) => set({ userIds }),
  setExcludeNumbers: (excludeNumbers) => set({ excludeNumbers }),
  reset: () => set({ range: "today", from: undefined, to: undefined, userIds: [], excludeNumbers: true }),
}));

/** Query params for every range-based endpoint. */
export function filterParams(f: Pick<Filters, "range" | "from" | "to" | "userIds" | "excludeNumbers">) {
  return {
    range: f.range,
    ...(f.range === "custom" ? { from: f.from, to: f.to } : {}),
    ...(f.userIds.length ? { userIds: f.userIds.join(",") } : {}),
    excludeNumbers: String(f.excludeNumbers),
  };
}

export function useFilterParams() {
  const range = useFilters((s) => s.range);
  const from = useFilters((s) => s.from);
  const to = useFilters((s) => s.to);
  const userIds = useFilters((s) => s.userIds);
  const excludeNumbers = useFilters((s) => s.excludeNumbers);
  return filterParams({ range, from, to, userIds, excludeNumbers });
}
