import { apiClient } from "@api/apiClient";
import type { Billing, Invoice, Purchase, Quote } from "../types";

export const billingApi = Object.freeze({
  get: async () => (await apiClient.get<{ data: Billing }>("/billing")).data.data,
  quote: async (p: Purchase) => (await apiClient.post<{ data: Quote }>("/billing/quote", p)).data.data,
  checkout: async (p: Purchase) => (await apiClient.post<{ data: Invoice }>("/billing/checkout", p)).data.data,
  invoice: async (id: string) => (await apiClient.get<{ data: Invoice }>(`/billing/invoices/${id}`)).data.data,
  testPay: async (id: string) => (await apiClient.post<{ data: Invoice }>(`/billing/invoices/${id}/test-pay`)).data.data,
});
