interface Slice {
  total: number;
  durationSec: number;
  connected: number;
  avgConnectedSec: number;
}

export interface EmployeeRow {
  userId: string;
  name: string;
  total: number;
  totalDurationSec: number;
  connected: number;
  talkSec: number;
  avgConnectedSec: number;
  uniqueClients: number;
  neverAttended: number;
  notPickedUp: number;
  incoming: number;
  outgoing: number;
  missed: number;
  rejected: number;
  blocked: number;
  whatsapp: number;
  working: Slice;
  nonWorking: Slice;
}

export interface Monthly {
  month: string;
  metric: string;
  days: string[];
  rows: { userId: string; name: string; values: number[]; total: number }[];
  max: number;
}

export interface ClientRow {
  phone: string;
  name: string;
  calls: number;
  connects: number;
  talkSec: number;
  lastAt: string;
  lastType: string;
  employee: string;
}

export type ClientKind = "never_attended" | "not_picked_up" | "unique";

export const MONTHLY_METRICS: { id: string; label: string; time?: boolean }[] = [
  { id: "total_calls", label: "Total calls" },
  { id: "connected_calls", label: "Connected" },
  { id: "talk_time", label: "Talk time", time: true },
  { id: "incoming_calls", label: "Incoming" },
  { id: "outgoing_calls", label: "Outgoing" },
  { id: "missed_calls", label: "Missed" },
  { id: "rejected_calls", label: "Rejected" },
  { id: "whatsapp_calls", label: "WhatsApp" },
  { id: "unique_clients", label: "Unique clients" },
];
