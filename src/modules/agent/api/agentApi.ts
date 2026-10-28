import { Platform } from "react-native";
import { apiClient } from "@api/apiClient";
import type { PickedFile } from "@modules/settings/types";
import type { Campaign, CampaignInput, Lead, LeadImport } from "../types";

export const agentApi = Object.freeze({
  list: async () => {
    const r = await apiClient.get<{ data: Campaign[]; meta: { ready: boolean } }>("/campaigns");
    return { items: r.data.data, ready: r.data.meta.ready };
  },
  create: async (c: CampaignInput) => (await apiClient.post<{ data: Campaign }>("/campaigns", c)).data.data,
  update: async (id: string, c: CampaignInput) => (await apiClient.put<{ data: Campaign }>(`/campaigns/${id}`, c)).data.data,
  start: async (id: string) => (await apiClient.post<{ data: Campaign }>(`/campaigns/${id}/start`)).data.data,
  pause: async (id: string) => (await apiClient.post<{ data: Campaign }>(`/campaigns/${id}/pause`)).data.data,
  leads: async (id: string) => (await apiClient.get<{ data: Lead[] }>(`/campaigns/${id}/leads`)).data.data,
  importLeads: async (id: string, f: PickedFile) => {
    const form = new FormData();
    if (Platform.OS === "web" && f.file) form.append("file", f.file, f.name);
    else form.append("file", { uri: f.uri, name: f.name, type: f.mimeType ?? "text/csv" } as unknown as Blob);
    return (
      await apiClient.post<{ data: LeadImport }>(`/campaigns/${id}/leads`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      })
    ).data.data;
  },
});
