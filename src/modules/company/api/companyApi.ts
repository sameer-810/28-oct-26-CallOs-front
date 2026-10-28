import { apiClient } from "@api/apiClient";
import type { Company } from "@modules/auth/types";
import type { CompanyUpdate } from "../types";

export const companyApi = Object.freeze({
  update: async (patch: CompanyUpdate) => (await apiClient.patch<{ data: Company }>("/company", patch)).data.data,

  rotateCode: async () => (await apiClient.post<{ data: Company }>("/company/code")).data.data,
});
