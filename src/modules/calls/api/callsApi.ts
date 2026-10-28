import { apiClient } from "@api/apiClient";
import type { Call, CallDetail, CallPage, CallPatch } from "../types";

export const callsApi = Object.freeze({
  list: async (params: Record<string, string | number | undefined>): Promise<CallPage> => {
    const res = await apiClient.get<{ data: Call[]; meta: { total: number; pages: number; page: number } }>("/calls", { params });
    return { items: res.data.data, ...res.data.meta };
  },

  get: async (id: string) => (await apiClient.get<{ data: CallDetail }>(`/calls/${id}`)).data.data,

  /** A signed link, good for ten minutes: fetched only when someone presses play. */
  recordingUrl: async (id: string) => (await apiClient.get<{ data: { url: string } }>(`/calls/${id}/recording-url`)).data.data.url,

  transcribe: async (id: string) => (await apiClient.post<{ data: CallDetail }>(`/calls/${id}/transcribe`)).data.data,

  update: async (id: string, patch: CallPatch) => (await apiClient.patch<{ data: CallDetail }>(`/calls/${id}`, patch)).data.data,

  followUps: async (when: "overdue" | "today" | "upcoming" | "all" = "all") => {
    const res = await apiClient.get<{ data: Call[]; meta: { overdue: number; today: number } }>("/calls/follow-ups", {
      params: { when, limit: 30 },
    });
    return { items: res.data.data, counts: res.data.meta };
  },
});
