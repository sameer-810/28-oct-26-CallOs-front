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

  /** Emails a 6-digit code. Answers the same whether or not the email has an account. */
  forgotPassword: async (email: string) => {
    await apiClient.post("/auth/forgot-password", { email });
  },

  /** Sets a new password from the emailed code; every device is signed out. */
  resetPassword: async (body: { email: string; code: string; newPassword: string }) => {
    await apiClient.post("/auth/reset-password", body);
  },

  /** Deletes your own account (not the owner's). The password is asked again. */
  deleteAccount: async (password: string) => {
    await apiClient.delete("/auth/me", { data: { password } });
  },

  me: async () => (await apiClient.get<{ data: { user: AuthUser; company: Company } }>("/auth/me")).data.data,
});
