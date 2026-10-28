import { keepPreviousData, useQueries, useQuery } from "@tanstack/react-query";
import { useFilterParams } from "@shared/store/useFilters";
import { analyticsApi } from "../api/analyticsApi";
import type { GlancePeriod } from "../types";

/**
 * The dashboard numbers for whatever range and people are picked. Reports
 * pass their own narrower cuts (`extra`); the dashboard never does.
 */
export function useSummary(extra: Record<string, string> = {}) {
  const params = { ...useFilterParams(), ...extra };
  return useQuery({
    queryKey: ["summary", params],
    queryFn: () => analyticsApi.summary(params),
    placeholderData: keepPreviousData,
    // the floor is live during the day; a minute old is fine, an hour isn't
    refetchInterval: params.range === "today" ? 60_000 : false,
  });
}

/** This week's top performer and this month's deals. Managers only — the API refuses a rep. */
export function useHighlights(enabled: boolean) {
  return useQuery({ queryKey: ["highlights"], queryFn: analyticsApi.highlights, enabled, staleTime: 60_000 });
}

export const GLANCE_PERIODS: GlancePeriod[] = ["today", "yesterday", "last_week"];

/**
 * Today, yesterday and last week side by side, for the whole team, whatever
 * range the rest of the dashboard is on — the comparison a manager makes
 * every morning without touching a filter.
 */
export function useGlance(enabled: boolean) {
  return useQueries({
    queries: GLANCE_PERIODS.map((range) => ({
      queryKey: ["summary", { range, excludeNumbers: "true" }],
      queryFn: () => analyticsApi.summary({ range, excludeNumbers: "true" }),
      enabled,
      staleTime: 60_000,
    })),
  });
}
