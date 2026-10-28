import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@shared/store/useAuthStore";
import type { Company } from "@modules/auth/types";
import { settingsApi } from "../api/settingsApi";

/** Saves a company setting and puts the server's answer straight into the session. */
function useCompanySave<A>(fn: (a: A) => Promise<Company>, alsoInvalidate: string[] = []) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (company) => {
      const { user, setProfile } = useAuthStore.getState();
      if (user) setProfile(user, company);
      qc.invalidateQueries({ queryKey: ["summary"] });
      for (const key of alsoInvalidate) qc.invalidateQueries({ queryKey: [key] });
    },
  });
}

export const useSaveDispositions = () => useCompanySave(settingsApi.setDispositions);
export const useSaveWorkingHours = () => useCompanySave(settingsApi.setWorkingHours);
export const useSaveNotifications = () => useCompanySave(settingsApi.setNotifications);
export const useUpdateOrganization = () => useCompanySave(settingsApi.updateCompany);
// the softphone reads the caller ID from the telephony status
export const useSaveTelephonyNumber = () => useCompanySave(settingsApi.setTelephonyNumber, ["telephony"]);

export function useExcludedNumbers(search: string) {
  return useQuery({ queryKey: ["excluded", search], queryFn: () => settingsApi.excluded.list(search) });
}

/** An excluded number changes what every report counts, so the totals refetch too. */
function useExcludedMutation<A, R>(fn: (a: A) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["excluded"] });
      qc.invalidateQueries({ queryKey: ["summary"] });
    },
  });
}

export const useAddExcluded = () => useExcludedMutation(settingsApi.excluded.add);
export const useSetExcludedActive = () => useExcludedMutation((a: { id: string; on: boolean }) => settingsApi.excluded.setActive(a.id, a.on));
export const useRemoveExcluded = () => useExcludedMutation(settingsApi.excluded.remove);
export const useImportExcluded = () => useExcludedMutation(settingsApi.excluded.import);
