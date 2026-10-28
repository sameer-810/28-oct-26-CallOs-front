import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { opportunitiesApi } from "../api/opportunitiesApi";

export function useOpportunities(params: Record<string, string | number | undefined>) {
  return useQuery({ queryKey: ["opportunities", params], queryFn: () => opportunitiesApi.list(params), placeholderData: keepPreviousData });
}

/** Key numbers for the same filters as the list, without the paging. */
export function useOpportunitySummary(params: Record<string, string | number | undefined>) {
  return useQuery({
    queryKey: ["opportunities", "summary", params],
    queryFn: () => opportunitiesApi.summary(params),
    placeholderData: keepPreviousData,
  });
}

/** Closing or reopening a deal moves the client between the tabs and the totals. */
export function useSetDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, s }: { id: string; s: "open" | "closed" }) => opportunitiesApi.setDeal(id, s),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["opportunities"] }),
  });
}
