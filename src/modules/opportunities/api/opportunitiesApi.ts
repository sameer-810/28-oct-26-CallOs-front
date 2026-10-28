import { apiClient } from "@api/apiClient";
import type { OpportunityPage, OpportunitySummary } from "../types";

export const opportunitiesApi = Object.freeze({
  list: async (params: Record<string, string | number | undefined>) =>
    (await apiClient.get<{ data: OpportunityPage }>("/contacts/opportunities", { params })).data.data,

  summary: async (params: Record<string, string | number | undefined>) =>
    (await apiClient.get<{ data: OpportunitySummary }>("/contacts/opportunities/summary", { params })).data.data,

  setDeal: async (contactId: string, dealStatus: "open" | "closed") =>
    (await apiClient.patch(`/contacts/${contactId}/deal`, { dealStatus })).data.data,
});
