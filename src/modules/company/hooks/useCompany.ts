import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@shared/store/useAuthStore";
import type { Company } from "@modules/auth/types";
import { companyApi } from "../api/companyApi";

function useStoreCompany() {
  const qc = useQueryClient();
  return (company: Company) => {
    const { user, setProfile } = useAuthStore.getState();
    if (user) setProfile(user, company);
    qc.invalidateQueries({ queryKey: ["me"] });
  };
}

export function useUpdateCompany() {
  const store = useStoreCompany();
  return useMutation({ mutationFn: companyApi.update, onSuccess: store });
}

export function useRotateCode() {
  const store = useStoreCompany();
  return useMutation({ mutationFn: companyApi.rotateCode, onSuccess: store });
}
