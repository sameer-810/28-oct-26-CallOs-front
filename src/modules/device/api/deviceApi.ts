import { apiClient } from "@api/apiClient";
import type { ApiCall } from "../syncRules";
import type { BatchResult, DeviceInfo, DeviceReport } from "../types";

export const deviceApi = Object.freeze({
  /** Every rep's phone, for the manager. */
  list: async () => (await apiClient.get<{ data: DeviceInfo[] }>("/devices")).data.data,

  report: async (body: DeviceReport) => {
    await apiClient.put("/devices/me", body);
  },

  sendCalls: async (deviceId: string, calls: ApiCall[]) =>
    (await apiClient.post<{ data: BatchResult }>("/calls/batch", { deviceId, calls })).data.data,

  /** A recording is tens of megabytes on a phone connection: give it two minutes. */
  uploadRecording: async (callId: string, file: { uri: string; name: string; type: string }) => {
    const form = new FormData();
    // React Native's FormData takes a { uri, name, type } descriptor for files
    form.append("file", file as unknown as Blob);
    await apiClient.post(`/calls/${callId}/recording`, form, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 120_000,
    });
  },
});
