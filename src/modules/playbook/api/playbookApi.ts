import { apiClient } from "@api/apiClient";
import type { BuiltInEntry, EntryInput, EntryType, Industry, OwnEntry, Playbook } from "../types";

export const playbookApi = Object.freeze({
  list: async (params: { type?: EntryType; industry?: Industry }): Promise<Playbook> => {
    const r = await apiClient.get<{ data: { own: OwnEntry[]; builtIn: BuiltInEntry[] }; meta: { industry: Industry; companyIndustry: string; companyLibrary: Industry; industries: Industry[] } }>(
      "/playbook",
      { params },
    );
    return { ...r.data.data, ...r.data.meta };
  },
  create: async (e: EntryInput) => (await apiClient.post<{ data: OwnEntry }>("/playbook", e)).data.data,
  update: async (id: string, e: EntryInput) => (await apiClient.put<{ data: OwnEntry }>(`/playbook/${id}`, e)).data.data,
  remove: async (id: string) => {
    await apiClient.delete(`/playbook/${id}`);
  },
});
