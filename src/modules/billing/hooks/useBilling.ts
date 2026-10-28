import { useEffect } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { billingApi } from "../api/billingApi";
import type { Purchase } from "../types";

export function useBilling() {
  return useQuery({ queryKey: ["billing"], queryFn: billingApi.get });
}

/** The bill as the owner changes plan, seats or term; the last one stays up while the next loads. */
export function useBillingQuote(purchase: Purchase, enabled: boolean) {
  return useQuery({
    queryKey: ["billing", "quote", purchase],
    queryFn: () => billingApi.quote(purchase),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useCheckout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (purchase: Purchase) => billingApi.checkout(purchase),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["billing"] }),
  });
}

/**
 * A pending invoice, re-read every few seconds until Razorpay's webhook marks
 * it paid. Then the plan, seats and the renew screen all follow from the new
 * state, so billing and the session are re-read.
 */
export function useInvoice(id: string | null) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["billing", "invoice", id],
    queryFn: () => billingApi.invoice(id!),
    enabled: Boolean(id),
    refetchInterval: (q) => (q.state.data?.status === "pending" ? 3000 : false),
  });
  const paid = query.data?.status === "paid";
  useEffect(() => {
    if (!paid) return;
    qc.invalidateQueries({ queryKey: ["billing"] });
    qc.invalidateQueries({ queryKey: ["me"] });
  }, [paid, qc]);
  return query;
}

/** Test mode only: stands in for the webhook. */
export function useTestPay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => billingApi.testPay(id),
    onSuccess: (inv) => qc.setQueryData(["billing", "invoice", inv.id], inv),
  });
}
