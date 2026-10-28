import { apiClient } from "@api/apiClient";
import type { AuthUser, Role } from "@modules/auth/types";
import type { TeamMember, TeamPage, TeamQuery } from "../types";

export const teamApi = Object.freeze({
  list: async ({ search, status = "all" }: TeamQuery): Promise<TeamPage> => {
    const res = await apiClient.get<{ data: TeamMember[]; meta: { total: number } }>("/users", {
      params: { status, limit: 100, ...(search ? { search } : {}) },
    });
    return { items: res.data.data, total: res.data.meta.total };
  },

  setRole: async (id: string, role: Exclude<Role, "owner">) =>
    (await apiClient.patch<{ data: AuthUser }>(`/users/${id}/role`, { role })).data.data,

  setStatus: async (id: string, isActive: boolean) =>
    (await apiClient.patch<{ data: AuthUser }>(`/users/${id}/status`, { isActive })).data.data,

  updateMe: async (patch: { name?: string; email?: string | null }) =>
    (await apiClient.patch<{ data: AuthUser }>("/users/me", patch)).data.data,
});
