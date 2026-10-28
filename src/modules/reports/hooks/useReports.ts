import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { reportsApi } from "../api/reportsApi";
import type { ClientKind } from "../types";

type P = Record<string, string | number | undefined>;

export function useEmployeeReport(params: P) {
  return useQuery({ queryKey: ["report-employees", params], queryFn: () => reportsApi.employees(params), placeholderData: keepPreviousData });
}

export function useMonthlyReport(params: P) {
  return useQuery({ queryKey: ["report-monthly", params], queryFn: () => reportsApi.monthly(params), placeholderData: keepPreviousData });
}

export function useClientReport(kind: ClientKind, params: P) {
  return useQuery({ queryKey: ["report-clients", kind, params], queryFn: () => reportsApi.clients({ ...params, kind }), placeholderData: keepPreviousData });
}
