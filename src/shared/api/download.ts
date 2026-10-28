import { Platform } from "react-native";
import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";
import { environment } from "@config/env";
import { useAuthStore } from "../store/useAuthStore";
import { apiClient } from "./apiClient";

type Params = Record<string, string | number | boolean | undefined | null>;

function query(params: Params) {
  const q = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");
  return q ? `?${q}` : "";
}

/**
 * Downloads an authenticated export. On the web the browser saves it; on a
 * phone it lands in the cache and the share sheet opens, so it can go to
 * WhatsApp, Drive or Files.
 */
export async function downloadExport(path: string, params: Params, filename: string) {
  if (Platform.OS === "web") {
    const res = await apiClient.get(`${path}${query(params)}`, { responseType: "blob" });
    const url = URL.createObjectURL(res.data as Blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return;
  }

  // make sure the token is fresh: this request bypasses the axios interceptor
  await apiClient.get("/auth/me");
  const token = useAuthStore.getState().token;
  const file = await File.downloadFileAsync(`${environment.apiUrl}${path}${query(params)}`, new File(Paths.cache, filename), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    idempotent: true,
  });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri);
}
