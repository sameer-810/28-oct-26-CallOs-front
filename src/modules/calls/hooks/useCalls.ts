import { useMemo } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { callsApi } from "../api/callsApi";
import { CallTracker } from "@/modules/call-tracker";
import { deviceApi } from "@modules/device/api/deviceApi";
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

/**
 * A recording shared into the app ("Share → Ringwise") attached to a call by
 * hand — for phones whose dialler saves recordings where the app can't find
 * them. Copied out of the sharing app first, since its grant is temporary.
 */
export function useAttachRecording() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ callId, uri, name, mime }: { callId: string; uri: string; name: string; mime: string }) => {
      const ext = (name.match(/\.([a-z0-9]{2,5})$/i)?.[1] ?? "m4a").toLowerCase();
      const local = CallTracker ? await CallTracker.copyToCache(uri, `${callId}.${ext}`) : uri;
      await deviceApi.uploadRecording(callId, { uri: local, name: `${callId}.${ext}`, type: mime.startsWith("audio/") ? mime : "audio/mp4" });
      return callId;
    },
    onSuccess: (callId) => {
      qc.invalidateQueries({ queryKey: ["call", callId] });
      qc.invalidateQueries({ queryKey: ["calls"] });
    },
  });
}
