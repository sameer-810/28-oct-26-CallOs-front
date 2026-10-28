import { Platform } from "react-native";
import { apiClient } from "@api/apiClient";
import type { Company, WorkingHours } from "@modules/auth/types";
import type { ExcludedNumber, ImportResult, PickedFile } from "../types";

export const settingsApi = Object.freeze({
  updateCompany: async (patch: Partial<Pick<Company, "name" | "industry" | "teamSize" | "website" | "gstin" | "address">>) =>
    (await apiClient.patch<{ data: Company }>("/company", patch)).data.data,

  setDispositions: async (editable: { key?: string; label: string; tone: string }[]) =>
    (await apiClient.put<{ data: Company }>("/company/dispositions", { editable })).data.data,

  setWorkingHours: async (wh: WorkingHours) => (await apiClient.put<{ data: Company }>("/company/working-hours", wh)).data.data,

  setTelephonyNumber: async (number: string | null) => (await apiClient.patch<{ data: Company }>("/company/telephony", { number })).data.data,

  setNotifications: async (patch: { afterCallPopup?: boolean; dailyReport?: NonNullable<Company["dailyReport"]> }) =>
    (await apiClient.patch<{ data: Company }>("/company/notifications", patch)).data.data,

  excluded: {
    list: async (search: string) => {
      const res = await apiClient.get<{ data: ExcludedNumber[]; meta: { total: number } }>("/excluded-numbers", {
        params: { limit: 200, ...(search ? { search } : {}) },
      });
      return { items: res.data.data, total: res.data.meta.total };
    },
    add: async ({ phone, name }: { phone: string; name: string }) => (await apiClient.post("/excluded-numbers", { phone, name })).data.data,
    setActive: async (id: string, isActive: boolean) => (await apiClient.patch(`/excluded-numbers/${id}`, { isActive })).data.data,
    remove: async (id: string) => apiClient.delete(`/excluded-numbers/${id}`),
    import: async (f: PickedFile) => {
      const form = new FormData();
      if (Platform.OS === "web" && f.file) form.append("file", f.file, f.name);
      // React Native's FormData takes a { uri, name, type } descriptor for files
      else form.append("file", { uri: f.uri, name: f.name, type: f.mimeType ?? "application/octet-stream" } as unknown as Blob);
      const res = await apiClient.post<{ data: ImportResult }>("/excluded-numbers/import", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return res.data.data;
    },
  },
});
