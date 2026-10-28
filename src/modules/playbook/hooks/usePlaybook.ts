import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { playbookApi } from "../api/playbookApi";
import type { EntryInput, EntryType, Industry } from "../types";

/** The company's own entries and the library for an industry (the company's, when none is picked). */
export function usePlaybook(type: EntryType, industry?: Industry) {
  return useQuery({ queryKey: ["playbook", type, industry ?? "mine"], queryFn: () => playbookApi.list({ type, industry }) });
}

/** Templates change rarely and the composer opens on every call: five minutes is fresh enough. */
export function useWhatsAppTemplates() {
  return useQuery({ queryKey: ["playbook", "whatsapp"], queryFn: () => playbookApi.list({ type: "whatsapp" }), staleTime: 5 * 60_000 });
}

/** `id` set: rewrite that entry; otherwise add one. */
export function useSaveEntry(id?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (e: EntryInput) => (id ? playbookApi.update(id, e) : playbookApi.create(e)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["playbook"] }),
  });
}

export function useDeleteEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => playbookApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["playbook"] }),
  });
}
