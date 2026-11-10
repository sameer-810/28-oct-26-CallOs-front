import { useQuery } from "@tanstack/react-query";
import { analyticsApi } from "@modules/dashboard/api/analyticsApi";
import { callsApi } from "@modules/calls/api/callsApi";

/** One employee's last 30 days, whatever range the dashboard is on. */
export function useMemberSummary(userId: string) {
  const params = { range: "last30", userIds: userId };
  return useQuery({ queryKey: ["summary", params], queryFn: () => analyticsApi.summary(params), staleTime: 60_000 });
}

/** Their latest calls, newest first. */
export function useMemberCalls(userId: string) {
  const params = { range: "last30", userIds: userId, limit: 8 };
  return useQuery({ queryKey: ["calls", params], queryFn: () => callsApi.list(params), staleTime: 30_000 });
}
