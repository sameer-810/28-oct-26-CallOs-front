import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@shared/store/useAuthStore";
import { inboxApi } from "../api/inboxApi";

export function useInbox() {
  return useQuery({ queryKey: ["inbox", "list"], queryFn: inboxApi.list, staleTime: 0 });
}

/** The nav badge. Polls once a minute while signed in; opening the inbox refreshes it. */
export function useUnreadCount() {
  const signedIn = useAuthStore((s) => Boolean(s.user));
  return useQuery({ queryKey: ["inbox", "unread"], queryFn: inboxApi.unread, enabled: signedIn, refetchInterval: 60_000, staleTime: 30_000 });
}

/** Ids: those; none: everything. The list and the badge both refresh. */
export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids?: string[]) => inboxApi.read(ids),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inbox"] }),
  });
}
