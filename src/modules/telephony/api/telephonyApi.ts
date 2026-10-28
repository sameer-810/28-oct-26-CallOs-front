import { apiClient } from "@api/apiClient";
import type { TelephonyStatus } from "../types";

export const telephonyApi = Object.freeze({
  status: async () => (await apiClient.get<{ data: TelephonyStatus }>("/telephony/status")).data.data,
  /** A short-lived Voice SDK token for this browser. */
  token: async () => (await apiClient.post<{ data: { token: string } }>("/telephony/token")).data.data.token,
});
