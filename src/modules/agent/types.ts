export type Outcome = "booked" | "qualified" | "callback" | "not_interested" | "wrong_number" | "do_not_call" | "transferred" | "no_answer" | "failed";

export interface AgentSettings {
  name: string;
  language: "en-IN" | "hi-IN";
  goal: string;
  questions: string[];
  knowledge: string;
  greeting: string;
  transferNumber: string | null;
  callingHours: { start: string; end: string; days: number[] };
}

export interface Campaign {
  id: string;
  name: string;
  status: "draft" | "running" | "paused" | "done";
  agent: AgentSettings;
  concurrency: number;
  maxAttempts: number;
  retryAfterMin: number;
  createdAt: string;
  stats: { total: number; pending: number; calling: number; done: number; outcomes: Record<Outcome, number> };
}

export interface Lead {
  id: string;
  phone: string;
  name: string;
  notes: string;
  state: "pending" | "calling" | "done";
  outcome: Outcome | null;
  summary: string;
  answers: Record<string, string>;
  bookedAt: string | null;
  attempts: number;
  nextAttemptAt: string | null;
  callId: string | null;
}

export type CampaignInput = Pick<Campaign, "name" | "agent" | "concurrency" | "maxAttempts" | "retryAfterMin">;

export const OUTCOME_LABEL: Record<Outcome, string> = {
  booked: "Booked",
  qualified: "Qualified",
  callback: "Call back",
  not_interested: "Not interested",
  wrong_number: "Wrong number",
  do_not_call: "Do not call",
  transferred: "Sent to a person",
  no_answer: "No answer",
  failed: "Couldn't call",
};

/** What a lead upload did: bad and excluded numbers are reported, not added. */
export interface LeadImport {
  added: number;
  duplicates: number;
  skippedExcluded: number;
  invalidCount: number;
}
