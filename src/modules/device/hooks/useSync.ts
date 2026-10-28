import { useMutation, useQueryClient } from "@tanstack/react-query";
import { syncNow } from "../syncEngine";

/** "Sync now": send the phone's calls, then show them. */
export function useSyncNow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: syncNow,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["calls"] });
      qc.invalidateQueries({ queryKey: ["summary"] });
    },
  });
}
