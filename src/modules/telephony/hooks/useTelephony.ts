import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as phone from "../softphone";
import { telephonyApi } from "../api/telephonyApi";

export function useTelephony() {
  return useQuery({ queryKey: ["telephony"], queryFn: telephonyApi.status, staleTime: 5 * 60_000 });
}

/** Whether a "Call" button should show here: a phone always can; a browser only once cloud calling is set up. */
export function useCanCall() {
  const t = useTelephony();
  if (phone.softphoneKind === "dialer") return true;
  return phone.softphoneKind === "browser" && Boolean(t.data?.enabled);
}

/** A browser call just ended and the server has logged it: the lists and totals should show it. */
export function useRefreshAfterCall() {
  const qc = useQueryClient();
  return useCallback(() => {
    qc.invalidateQueries({ queryKey: ["calls"] });
    qc.invalidateQueries({ queryKey: ["summary"] });
  }, [qc]);
}
