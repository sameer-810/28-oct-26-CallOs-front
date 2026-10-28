import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PickedFile } from "@modules/settings/types";
import { agentApi } from "../api/agentApi";
import type { Campaign, CampaignInput } from "../types";

/** Re-read while open: the dialer moves leads and counts every few seconds. */
export function useCampaigns() {
  return useQuery({ queryKey: ["campaigns"], queryFn: agentApi.list, refetchInterval: 15_000 });
}

export function useLeads(c: Campaign) {
  return useQuery({ queryKey: ["leads", c.id], queryFn: () => agentApi.leads(c.id), refetchInterval: c.status === "running" ? 10_000 : false });
}

/** `id` set: edit that campaign; otherwise create one. */
export function useSaveCampaign(id: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CampaignInput) => (id ? agentApi.update(id, input) : agentApi.create(input)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campaigns"] }),
  });
}

/** Starting, pausing or adding leads changes both the campaign's counts and its lead list. */
function useCampaignMutation<A, R>(campaignId: string, fn: (a: A) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaigns"] });
      qc.invalidateQueries({ queryKey: ["leads", campaignId] });
    },
  });
}

export const useRunCampaign = (c: Campaign) =>
  useCampaignMutation(c.id, () => (c.status === "running" ? agentApi.pause(c.id) : agentApi.start(c.id)));

export const useImportLeads = (campaignId: string) => useCampaignMutation(campaignId, (f: PickedFile) => agentApi.importLeads(campaignId, f));
