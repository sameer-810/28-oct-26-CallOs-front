import { useQuery } from "@tanstack/react-query";
import { deviceApi } from "../api/deviceApi";

/** Every rep's phone and how it's doing, for the Team screen. */
export function useDevices(enabled: boolean) {
  return useQuery({ queryKey: ["devices"], queryFn: deviceApi.list, enabled, staleTime: 60_000 });
}
