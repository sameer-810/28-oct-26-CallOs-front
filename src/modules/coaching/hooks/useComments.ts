import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { commentsApi, type CommentBody } from "../api/commentsApi";
import type { CallComment } from "../types";

export function useComments(callId: string) {
  return useQuery({ queryKey: ["comments", callId], queryFn: () => commentsApi.list(callId) });
}

/** The thread is updated from the answer, so the new comment and its rail tick show at once. */
export function useAddComment(callId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CommentBody) => commentsApi.add(callId, body),
    onSuccess: (c) => qc.setQueryData<CallComment[]>(["comments", callId], (old) => [...(old ?? []), c]),
  });
}

export function useRemoveComment(callId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => commentsApi.remove(callId, id),
    onSuccess: (_r, id) => qc.setQueryData<CallComment[]>(["comments", callId], (old) => (old ?? []).filter((c) => c.id !== id)),
  });
}
