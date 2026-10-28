import { apiClient } from "@api/apiClient";
import type { Highlights, Summary } from "../types";

export const analyticsApi = Object.freeze({
  summary: async (params: Record<string, string>) =>
    (await apiClient.get<{ data: Summary }>("/analytics/summary", { params })).data.data,

  highlights: async () => (await apiClient.get<{ data: Highlights }>("/analytics/highlights")).data.data,
});
