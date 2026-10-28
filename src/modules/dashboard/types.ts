export interface Totals {
  total: number;
  incoming: number;
  outgoing: number;
  missed: number;
  rejected: number;
  blocked: number;
  whatsapp: number;
  /** outgoing calls nobody picked up */
  unanswered: number;
  connected: number;
  talkSec: number;
  avgConnectedSec: number;
  workCalls: number;
  workTalkSec: number;
  nonWorkTalkSec: number;
  uniqueClients: number;
  neverAttended: number;
  notPickedUp: number;
}

export interface Summary {
  range: { from: string; to: string; name: string };
  totals: Totals;
  previous: { total: number; connected: number; talkSec: number; missed: number };
  byDay: { day: string; total: number; connected: number; missed: number; talkSec: number }[];
  byHour: { hour: number; total: number; connected: number }[];
  durations: { key: string; label: string; count: number }[];
  leaderboard: { rank: number; userId: string; name: string; total: number; connected: number; talkSec: number; missed: number }[];
  opportunities: {
    connects2: number;
    connects3: number;
    connects5: number;
    avgTalkSec: number;
    hotLeads: { phone: string; name: string; label: string; lastAt: string; connects: number; talkSec: number; employee: string }[];
  };
}

/** Who led the team this week (Monday start, company's zone). */
export interface TopSalesperson {
  userId: string;
  name: string;
  calls: number;
  connected: number;
  talkSec: number;
}

/** Deals this calendar month, by where they stand. */
export interface Pipeline {
  month: string;
  open: number;
  openAgain: number;
  closed: number;
  newClients: number;
}

export interface Highlights {
  topSalesperson: TopSalesperson | null;
  pipeline: Pipeline;
}

/** The three periods a manager compares without changing the range. */
export type GlancePeriod = "today" | "yesterday" | "last_week";
