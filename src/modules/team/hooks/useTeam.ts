import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@shared/store/useAuthStore";
import type { Role } from "@modules/auth/types";
import { teamApi } from "../api/teamApi";
import type { TeamQuery } from "../types";

export function useTeam(q: TeamQuery, enabled = true) {
  return useQuery({
    queryKey: ["team", q],
    queryFn: () => teamApi.list(q),
    placeholderData: keepPreviousData,
    // someone joining is exactly what this list is for; never show a cached copy as current
    staleTime: 0,
    enabled,
  });
}

export function useSetRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: Exclude<Role, "owner"> }) => teamApi.setRole(id, role),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["team"] }),
  });
}

export function useSetStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => teamApi.setStatus(id, isActive),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["team"] }),
  });
}

export function useUpdateMe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: teamApi.updateMe,
    onSuccess: (user) => {
      const { company, setProfile } = useAuthStore.getState();
      if (company) setProfile(user, company);
      qc.invalidateQueries({ queryKey: ["me"] });
    },
  });
}
