import type { DealStatus } from "@modules/calls/types";

export interface Opportunity {
  contactId: string | null;
  phone: string;
  name: string;
  total: number;
  incoming: number;
  outgoing: number;
  connects: number;
  talkSec: number;
  lastAt: string;
  lastStatus: string | null;
  employee: string;
  dealStatus: DealStatus;
  dealClosedCount: number;
}

export interface OpportunityPage {
  range: { from: string; to: string };
  total: number;
  summary: { open: number; openAgain: number; closed: number; closedDeals: number };
  items: Opportunity[];
}

/** The pipeline for the current filters, counted by the API across every matching client. */
export interface OpportunitySummary {
  total: number;
  open: number;
  openAgain: number;
  closed: number;
  /** 0–1: the share of these clients whose deal is closed. */
  closeRate: number;
  repeatClients: number;
  avgConnects: number;
}
