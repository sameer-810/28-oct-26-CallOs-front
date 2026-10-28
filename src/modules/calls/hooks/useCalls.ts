import { useMemo } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { callsApi } from "../api/callsApi";
import type { CallPatch } from "../types";

export function useCalls(params: Record<string, string | number | undefined>, enabled = true) {
  return useQuery({
    queryKey: ["calls", params],
    queryFn: () => callsApi.list(params),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useFollowUps() {
  return useQuery({ queryKey: ["follow-ups"], queryFn: () => callsApi.followUps("all") });
}

/**
 * Saves after-call fields. Everything that counts statuses or follow-ups is
 * refetched, so the dashboard never disagrees with the call you just edited.
 */
export function useUpdateCall() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: CallPatch }) => callsApi.update(id, patch),
    onSuccess: (call) => {
      qc.setQueryData(["call", call.id], call);
      qc.invalidateQueries({ queryKey: ["calls"] });
      qc.invalidateQueries({ queryKey: ["follow-ups"] });
      qc.invalidateQueries({ queryKey: ["summary"] });
      qc.invalidateQueries({ queryKey: ["opportunities"] });
    },
  });
}

/**
 * One call in full. The list row is enough to open on; the transcript and
 * analysis follow, and are re-read every few seconds while the AI is still
 * working on them.
 */
export function useCall(id: string) {
  return useQuery({
    queryKey: ["call", id],
    queryFn: () => callsApi.get(id),
    refetchInterval: (q) => (q.state.data && ["queued", "processing"].includes(q.state.data.transcript.status) ? 4000 : false),
  });
}

export function useTranscribe(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => callsApi.transcribe(id),
    onSuccess: (call) => qc.setQueryData(["call", id], call),
  });
}

/** Transcribe from a list row: the row's status changes, so every list refetches. */
export function useTranscribeCall() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => callsApi.transcribe(id),
    onSuccess: (call) => {
      qc.setQueryData(["call", call.id], call);
      qc.invalidateQueries({ queryKey: ["calls"] });
    },
  });
}

/**
 * Reads for a screen answering a notification: it needs one call to open,
 * not a list to render, so these are fetches rather than subscriptions.
 */
export function useCallFetchers() {
  const qc = useQueryClient();
  return useMemo(
    () => ({
      byId: (id: string) => qc.fetchQuery({ queryKey: ["call", id], queryFn: () => callsApi.get(id), staleTime: 0 }),
      /** The newest call of today for this person — the one that just ended. */
      latestOf: async (userId: string) => {
        try {
          return (await callsApi.list({ range: "today", userIds: userId, limit: 1 })).items[0] ?? null;
        } finally {
          qc.invalidateQueries({ queryKey: ["calls"] });
        }
      },
    }),
    [qc],
  );
}
