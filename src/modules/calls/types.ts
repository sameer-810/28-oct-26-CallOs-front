export type CallType = "incoming" | "outgoing" | "missed" | "rejected" | "blocked";
/** phone: the rep's SIM · whatsapp · cloud: a browser call · ai: the AI agent */
export type CallSource = "phone" | "whatsapp" | "cloud" | "ai";
export type DealStatus = "open" | "open_again" | "closed";

export interface Call {
  id: string;
  userId: string;
  employee: string | null;
  type: CallType;
  source: CallSource;
  phone: string;
  contactName: string;
  contactId: string | null;
  dealStatus: DealStatus | null;
  startedAt: string;
  durationSec: number;
  simSlot: number | null;
  simLabel: string;
  /** The phone that saw it, as people name phones: "Redmi Note 13". */
  device: string | null;
  recording: { status: "none" | "pending" | "uploaded" | "failed" };
  leadStatus: string | null;
  leadStatusLabel: string | null;
  followUpAt: string | null;
  followUpDone: boolean;
  followUpSource: "rep" | "ai" | null;
  notes: string;
  /** 0–100 from the AI review, null until the call is transcribed. */
  score: number | null;
  transcriptStatus: TranscriptStatus;
  summary: string | null;
}

export type TranscriptStatus = "none" | "queued" | "processing" | "done" | "failed" | "skipped";

export interface TranscriptLine {
  who: "rep" | "client";
  start: number;
  end: number;
  text: string;
}

export interface Insights {
  summary: string;
  outcome: string;
  suggestedStatus: string | null;
  sentiment: "positive" | "neutral" | "negative";
  rubric: { opening: number; discovery: number; objectionHandling: number; nextStep: number; tone: number };
  score: number;
  objections: { quote: string; topic: string; handled: boolean; at: number }[];
  promises: { by: "rep" | "client"; what: string; dueAt: string | null }[];
  nextStep: string;
  coaching: string[];
  model: string;
  at: string;
}

/** A call as the detail view gets it: everything, including the transcript. */
export interface CallDetail extends Call {
  transcript: { status: TranscriptStatus; language: string; lines: TranscriptLine[]; error: string | null };
  insights: Insights | null;
}

export interface CallPatch {
  leadStatus?: string | null;
  followUpAt?: string | null;
  followUpDone?: boolean;
  notes?: string;
}

export const TYPE_LABEL: Record<CallType, string> = {
  incoming: "Incoming",
  outgoing: "Outgoing",
  missed: "Missed",
  rejected: "Rejected",
  blocked: "Blocked",
};

export const SOURCE_LABEL: Record<CallSource, string> = {
  phone: "Phone",
  whatsapp: "WhatsApp",
  cloud: "Cloud call",
  ai: "AI agent",
};

export const TRANSCRIPT_LABEL: Record<TranscriptStatus, string> = {
  none: "Not transcribed",
  queued: "Waiting",
  processing: "Transcribing",
  done: "Transcribed",
  failed: "Failed",
  skipped: "Skipped",
};

export const DEAL_LABEL: Record<DealStatus, string> = {
  open: "Open",
  open_again: "Open again",
  closed: "Deal closed",
};

/** A call where two people actually spoke. */
export const isConnected = (c: Pick<Call, "type" | "durationSec">) =>
  (c.type === "incoming" || c.type === "outgoing") && c.durationSec > 0;

export interface CallPage {
  items: Call[];
  total: number;
  pages: number;
  page: number;
}

/** Columns the calls table can show; the chooser toggles any but Date and Phone. */
export type CallColumn =
  | "date"
  | "type"
  | "phone"
  | "contact"
  | "employee"
  | "duration"
  | "source"
  | "device"
  | "recording"
  | "status"
  | "followUp"
  | "notes"
  | "deal"
  | "score";

export const PAGE_SIZES = [25, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZES)[number];
