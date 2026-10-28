import { Platform } from "react-native";
import { apiClient } from "@api/apiClient";
import { getDeviceId, getDeviceName } from "@api/deviceId";
import type { AuthUser, Company, Industry, SessionPayload, TokenPair } from "../types";

async function device() {
  return {
    deviceId: await getDeviceId(),
    deviceName: getDeviceName(),
    platform: (["android", "ios", "web"].includes(Platform.OS) ? Platform.OS : "other") as
      | "android"
      | "ios"
      | "web"
      | "other",
  };
}

export interface SignUpInput {
  companyName: string;
  industry: Industry;
  name: string;
  phone: string;
  email: string;
  password: string;
}

export interface JoinInput {
  code: string;
  name: string;
  phone: string;
  email?: string;
  password: string;
}

export const authApi = Object.freeze({
  signUp: async (input: SignUpInput) =>
    (await apiClient.post<{ data: SessionPayload }>("/auth/signup", { ...input, ...(await device()) })).data.data,

  previewCode: async (code: string) =>
    (await apiClient.get<{ data: { name: string; industry: Industry } }>(`/auth/join/${encodeURIComponent(code)}`))
      .data.data,

  join: async (input: JoinInput) =>
    (await apiClient.post<{ data: SessionPayload }>("/auth/join", { ...input, ...(await device()) })).data.data,

  signIn: async (identifier: string, password: string) =>
    (await apiClient.post<{ data: SessionPayload }>("/auth/login", { identifier, password, ...(await device()) }))
      .data.data,

  /** Other sessions end; this one continues on the tokens that come back. */
  changePassword: async (body: { currentPassword: string; newPassword: string }) =>
    (await apiClient.post<{ data: TokenPair }>("/auth/change-password", body)).data.data,

  me: async () => (await apiClient.get<{ data: { user: AuthUser; company: Company } }>("/auth/me")).data.data,
});
