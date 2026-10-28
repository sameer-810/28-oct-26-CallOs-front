import { apiClient } from "@api/apiClient";
import type { ClientRow, EmployeeRow, Monthly } from "../types";

type P = Record<string, string | number | undefined>;

export const reportsApi = Object.freeze({
  employees: async (params: P) =>
    (await apiClient.get<{ data: { items: EmployeeRow[] } }>("/reports/employees", { params })).data.data.items,
  monthly: async (params: P) => (await apiClient.get<{ data: Monthly }>("/reports/monthly", { params })).data.data,
  clients: async (params: P) =>
    (await apiClient.get<{ data: { items: ClientRow[] } }>("/reports/clients", { params })).data.data.items,
});
