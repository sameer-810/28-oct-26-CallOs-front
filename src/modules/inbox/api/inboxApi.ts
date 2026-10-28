import { apiClient } from "@api/apiClient";
import type { Notice } from "../types";

export const inboxApi = Object.freeze({
  list: async () => {
    const r = await apiClient.get<{ data: Notice[]; meta: { unread: number } }>("/notifications", { params: { limit: 50 } });
    return { items: r.data.data, unread: r.data.meta.unread };
  },
  unread: async () => (await apiClient.get<{ data: { count: number } }>("/notifications/unread-count")).data.data.count,
  /** No ids: everything. */
  read: async (ids?: string[]) => {
    await apiClient.post("/notifications/read", ids ? { ids } : {});
  },
});
