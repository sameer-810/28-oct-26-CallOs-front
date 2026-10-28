import type { Subscription } from "@modules/auth/types";

export type PaidPlan = "starter" | "growth";
export interface Line {
  label: string;
  qty: number;
  unitPaise: number;
  amountPaise: number;
}
export interface Quote {
  kind: "subscription" | "change";
  lines: Line[];
  subtotalPaise: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalPaise: number;
  daysLeft?: number;
}
/** How Razorpay says it was paid; "test" in test mode. */
export type PaymentMethod = "upi" | "card" | "netbanking" | "wallet" | "emi" | "test";

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  upi: "UPI",
  card: "Card",
  netbanking: "Net banking",
  wallet: "Wallet",
  emi: "EMI",
  test: "Test mode",
};

export interface Invoice extends Omit<Quote, "kind" | "daysLeft"> {
  id: string;
  paymentMethod?: PaymentMethod | null;
  kind: "subscription" | "change";
  status: "pending" | "paid" | "cancelled";
  number: string | null;
  plan: PaidPlan;
  seats: number;
  months: number | null;
  periodStart: string | null;
  periodEnd: string | null;
  provider: "razorpay" | "test";
  payUrl: string | null;
  paidAt: string | null;
  createdAt: string;
}
export interface Billing {
  subscription: Subscription & { graceEndsAt: string | null };
  usedSeats: number;
  provider: "razorpay" | "test" | "off";
  plans: Record<PaidPlan, { label: string; perSeatPaise: number; flatPaise: number; insights: boolean }>;
  terms: number[];
  invoices: Invoice[];
}
export type Purchase = { kind: "subscription"; plan: PaidPlan; seats: number; months: number } | { kind: "change"; plan: PaidPlan; seats: number };
