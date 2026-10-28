import axios, { CanceledError, type InternalAxiosRequestConfig } from "axios";
import { environment } from "@config/env";
import { useAuthStore } from "../store/useAuthStore";

interface RetryableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
  /** who was signed in when this request was first sent */
  _userId?: string | null;
}

// axios.create is the documented API; the import plugin flags it as a lookalike
// eslint-disable-next-line import/no-named-as-default-member
export const apiClient = axios.create({
  baseURL: environment.apiUrl,
  headers: { "Content-Type": "application/json" },
  timeout: 30_000,
});

/**
 * Requests are pinned to whoever made them: if someone signs out and another
 * person signs in, a retry must not go out under the new person's token.
 */
const signedInAs = () => useAuthStore.getState().user?.id ?? null;

apiClient.interceptors.request.use((config) => {
  const pinned = config as RetryableConfig;
  if (pinned._userId === undefined) pinned._userId = signedInAs();
  else if (pinned._userId !== signedInAs()) {
    throw new CanceledError("The signed-in user changed", undefined, config);
  }
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/** Calls made while signed out: a 401 from these is a wrong password, not an expired token. */
const CREDENTIAL_CALL = /\/auth\/(login|signup|join|refresh)\b/;

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config as RetryableConfig | undefined;
    if (!original || CREDENTIAL_CALL.test(original.url ?? "")) return Promise.reject(error);
    if (original._userId && original._userId !== signedInAs()) return Promise.reject(error);

    const code = error.response?.data?.error?.code;
    if (code === "SUBSCRIPTION_EXPIRED") {
      // the plan ended while the app was open: show the renew screen now
      const s = useAuthStore.getState();
      if (s.user && s.company && s.company.subscription?.status !== "expired") {
        s.setProfile(s.user, { ...s.company, subscription: { ...s.company.subscription, status: "expired", daysLeft: 0 } });
      }
    } else if (code === "ACCOUNT_DISABLED" || code === "COMPANY_INACTIVE") {
      // switched off mid-session: nothing more this device can do
      await useAuthStore.getState().logout();
    } else if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const token = await useAuthStore.getState().refreshSession();
      if (token) {
        original.headers.Authorization = `Bearer ${token}`;
        return apiClient(original);
      }
    }
    return Promise.reject(error);
  },
);

/** The server's machine-readable error code, when it sent one. */
export function apiErrorCode(err: unknown): string | undefined {
  return (err as { response?: { data?: { error?: { code?: string } } } })?.response?.data?.error?.code;
}

/** The structured detail attached to a refusal, when there is any. */
export function apiErrorDetails<T>(err: unknown): T | undefined {
  return (err as { response?: { data?: { error?: { details?: T } } } })?.response?.data?.error?.details;
}

/** One readable sentence out of any failure shape. */
export function apiErrorMessage(err: unknown, fallback = "Something went wrong. Try again.") {
  const e = err as {
    code?: string;
    message?: string;
    response?: { data?: { error?: { message?: string; details?: { issues?: { message: string }[] } } } };
  };
  if (!e?.response) {
    if (e?.code === "ECONNABORTED") return "That took too long. Check your internet and try again.";
    if (err instanceof Error && /Network/i.test(err.message)) return "Can't reach the server. Check your internet.";
  }
  const error = e?.response?.data?.error;
  // a validation refusal: the first field's own message reads better than "Validation error"
  const first = error?.details?.issues?.[0]?.message;
  return first || error?.message || fallback;
}
