import { create } from "zustand";
import { useFilterParams } from "@shared/store/useFilters";
import type { CallSource, CallType } from "@modules/calls/types";

interface ReportFilters {
  types: CallType[];
  sources: CallSource[];
  /** "HH:MM" in the company's zone; both or neither. */
  timeFrom: string;
  timeTo: string;
  /** 0 = Sunday … 6 = Saturday. */
  excludeDays: number[];
  toggleType: (t: CallType) => void;
  toggleSource: (s: CallSource) => void;
  setWindow: (from: string, to: string) => void;
  toggleDay: (d: number) => void;
  clear: () => void;
}

const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

/**
 * The narrower cuts only reports offer — call type, source, a time of day,
 * days left out. Kept apart from the app-wide range so the dashboard is never
 * quietly filtered by a choice made on another screen.
 */
export const useReportFilters = create<ReportFilters>((set) => ({
  types: [],
  sources: [],
  timeFrom: "",
  timeTo: "",
  excludeDays: [],
  toggleType: (t) => set((s) => ({ types: toggle(s.types, t) })),
  toggleSource: (v) => set((s) => ({ sources: toggle(s.sources, v) })),
  setWindow: (timeFrom, timeTo) => set({ timeFrom, timeTo }),
  toggleDay: (d) => set((s) => ({ excludeDays: toggle(s.excludeDays, d).sort() })),
  clear: () => set({ types: [], sources: [], timeFrom: "", timeTo: "", excludeDays: [] }),
}));

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
/** A window only counts once both ends are real times and it runs forwards. */
export const validWindow = (from: string, to: string) => HHMM.test(from) && HHMM.test(to) && from < to;

/** Only the report-only filters, as query params. */
export function useReportExtras(): Record<string, string> {
  const types = useReportFilters((s) => s.types);
  const sources = useReportFilters((s) => s.sources);
  const timeFrom = useReportFilters((s) => s.timeFrom);
  const timeTo = useReportFilters((s) => s.timeTo);
  const excludeDays = useReportFilters((s) => s.excludeDays);
  return {
    ...(types.length ? { types: types.join(",") } : {}),
    ...(sources.length ? { sources: sources.join(",") } : {}),
    ...(validWindow(timeFrom, timeTo) ? { timeFrom, timeTo } : {}),
    ...(excludeDays.length ? { excludeDays: excludeDays.join(",") } : {}),
  };
}

/** Range, people and excluded numbers from the app, plus the report-only cuts. */
export function useReportParams(): Record<string, string> {
  const base = useFilterParams() as Record<string, string>;
  return { ...base, ...useReportExtras() };
}
