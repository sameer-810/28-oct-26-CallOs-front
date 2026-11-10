/**
 * What the phone sends, decided without a phone: pure rules over call-log
 * rows, unit-tested in tests/syncRules.test.ts.
 */

/** The fields of an Android call-log row these rules read. */
export interface LogRow {
  id: string;
  number: string;
  type: number;
  date: number;
  duration: number;
  name: string;
  simSlot: number | null;
}

export type ApiCallType = "incoming" | "outgoing" | "missed" | "rejected" | "blocked";

export interface ApiCall {
  clientCallId: string;
  type: ApiCallType;
  phone: string;
  contactName: string;
  startedAt: string;
  durationSec: number;
  simSlot: number | null;
  simLabel: string;
  /** phone unless said; WhatsApp calls come from the notification listener */
  source?: "phone" | "whatsapp";
}

/** android.provider.CallLog.Calls.TYPE → ours. 7 (answered on another device) is skipped. */
const TYPES: Record<number, ApiCallType> = {
  1: "incoming",
  2: "outgoing",
  3: "missed",
  4: "missed", // voicemail: the call itself was missed
  5: "rejected",
  6: "blocked",
};

/**
 * Only the work SIM is read. A row on another SIM is dropped; a row Android
 * didn't tag with a SIM is kept only on a single-SIM phone — on a dual-SIM
 * phone it might be a personal call, and a missed work call is the safer
 * mistake.
 */
export function onWorkSim(row: Pick<LogRow, "simSlot">, workSlot: number | null, simCount: number) {
  if (row.simSlot === null || row.simSlot === undefined) return simCount <= 1;
  return workSlot === null || row.simSlot === workSlot;
}

/** The call's stable id: Android's row id alone is reused after the log is cleared. */
export function clientCallId(row: Pick<LogRow, "id" | "date">) {
  return `${row.id}-${Math.round(row.date)}`;
}

export function toApiCall(row: LogRow, simLabel: string): ApiCall | null {
  const type = TYPES[row.type];
  const phone = (row.number ?? "").trim();
  // private / unknown numbers come through blank; there's nobody to call back
  if (!type || !phone) return null;
  return {
    clientCallId: clientCallId(row),
    type,
    phone,
    contactName: (row.name ?? "").slice(0, 120),
    startedAt: new Date(row.date).toISOString(),
    // missed calls sometimes carry ring time as "duration"; nobody spoke
    durationSec: type === "incoming" || type === "outgoing" ? Math.max(0, Math.min(row.duration, 12 * 3600)) : 0,
    simSlot: row.simSlot,
    simLabel,
  };
}

/** Rows → payload: work SIM only, mapped, de-duplicated, oldest first. */
export function buildBatch(rows: LogRow[], workSlot: number | null, simCount: number, simLabel: string) {
  const seen = new Set<string>();
  const out: ApiCall[] = [];
  for (const r of [...rows].sort((a, b) => a.date - b.date)) {
    if (!onWorkSim(r, workSlot, simCount)) continue;
    const c = toApiCall(r, simLabel);
    if (!c || seen.has(c.clientCallId)) continue;
    seen.add(c.clientCallId);
    out.push(c);
  }
  return out;
}

/**
 * Where the next read starts. Overlaps the last one by ten minutes: Android
 * writes a row when the call ends, so a long call can land "behind" the
 * watermark. The server ignores what it has already seen.
 */
export const OVERLAP_MS = 10 * 60_000;
export const FIRST_SYNC_MS = 24 * 3600_000;

export function readFrom(watermark: number | null, now: number) {
  return watermark ? watermark - OVERLAP_MS : now - FIRST_SYNC_MS;
}

/** Recordings worth looking for: answered, not uploaded, under a week old, not given up on. */
export const MAX_RECORDING_ATTEMPTS = 6;
export function wantsRecording(
  c: { durationSec: number; startedAt: string; recording: string },
  attempts: number,
  now: number,
) {
  return (
    c.durationSec >= 5 &&
    c.recording === "none" &&
    attempts < MAX_RECORDING_ATTEMPTS &&
    now - new Date(c.startedAt).getTime() < 7 * 86_400_000
  );
}

// ---- several work SIMs (callos-style SIM setup) ---------------------------

/** A SIM the rep set up for work on this phone. */
export interface WorkSim {
  slot: number;
  carrier: string;
  /** As the rep typed it; Android often won't tell us. */
  number: string;
  /** When it was set up: only calls after this are work calls. */
  configuredAt: number;
  /** When a test call proved it, or null until then. */
  verifiedAt: number | null;
}

/**
 * A row is a work call when it was on a set-up SIM, made after that SIM was
 * set up. Before setup, or on another SIM, it's the rep's own business.
 */
export function onWorkSims(row: Pick<LogRow, "simSlot" | "date">, sims: WorkSim[], simCount: number) {
  if (sims.length === 0) return false;
  const sim =
    row.simSlot === null || row.simSlot === undefined
      ? // untagged rows: only a single-SIM phone can say whose they are
        simCount <= 1 && sims.length === 1
        ? sims[0]
        : undefined
      : sims.find((s) => s.slot === row.simSlot);
  return Boolean(sim && row.date >= sim.configuredAt);
}

/** Rows → payload for the set-up SIMs: mapped, de-duplicated, oldest first. */
export function buildSimBatch(rows: LogRow[], sims: WorkSim[], simCount: number) {
  const seen = new Set<string>();
  const out: ApiCall[] = [];
  for (const r of [...rows].sort((a, b) => a.date - b.date)) {
    if (!onWorkSims(r, sims, simCount)) continue;
    const label = sims.find((s) => s.slot === r.simSlot)?.carrier || `SIM ${(r.simSlot ?? 0) + 1}`;
    const c = toApiCall(r, label);
    if (!c || seen.has(c.clientCallId)) continue;
    seen.add(c.clientCallId);
    out.push(c);
  }
  return out;
}

/**
 * The test call that proves a SIM: any outgoing call on that slot after it
 * was set up. Returns the slots newly proved.
 */
export function provedSlots(rows: Pick<LogRow, "type" | "simSlot" | "date">[], sims: WorkSim[]) {
  return sims
    .filter((s) => s.verifiedAt === null)
    .filter((s) => rows.some((r) => r.type === 2 && r.simSlot === s.slot && r.date >= s.configuredAt))
    .map((s) => s.slot);
}

/** SIMs set up but no longer in the phone (swapped or removed): setup has to be done again. */
export function simsChanged(sims: WorkSim[], present: { slot: number }[]) {
  const slots = new Set(present.map((p) => p.slot));
  return sims.some((s) => !slots.has(s.slot));
}

// ---- WhatsApp calls -------------------------------------------------------

export interface WhatsAppRow {
  id: string;
  type: "incoming" | "outgoing" | "missed";
  number: string | null;
  name: string;
  startedAt: number;
  durationSec: number;
}

/** A WhatsApp call for the server; null when we can't tell who it was with. */
export function whatsAppToApiCall(w: WhatsAppRow): (ApiCall & { source: "whatsapp" }) | null {
  const phone = (w.number ?? "").trim();
  if (phone.replace(/\D/g, "").length < 7) return null;
  return {
    clientCallId: w.id,
    type: w.type,
    source: "whatsapp",
    phone,
    contactName: w.name.slice(0, 120),
    startedAt: new Date(w.startedAt).toISOString(),
    durationSec: w.type === "missed" ? 0 : Math.max(0, Math.min(w.durationSec, 12 * 3600)),
    simSlot: null,
    simLabel: "WhatsApp",
  };
}

// ---- follow-up reminders --------------------------------------------------

export interface FollowupCall {
  id: string;
  userId: string;
  phone: string;
  contactName: string;
  followUpAt: string | null;
  followUpDone: boolean;
  leadStatusLabel: string | null;
}

/** The rep's own open follow-ups still ahead, as phone alarms. */
export function followupAlarms(calls: FollowupCall[], me: string, now: number) {
  return calls
    .filter((c) => c.userId === me && c.followUpAt && !c.followUpDone && new Date(c.followUpAt).getTime() > now)
    .map((c) => {
      const who = c.contactName || c.phone;
      return {
        id: c.id,
        at: new Date(c.followUpAt as string).getTime(),
        title: `Follow up: ${who}`,
        text: [c.contactName ? c.phone : "", c.leadStatusLabel ? `Status: ${c.leadStatusLabel}` : "", "Tap to open the call."]
          .filter(Boolean)
          .join(" · "),
        phone: c.phone,
      };
    });
}
