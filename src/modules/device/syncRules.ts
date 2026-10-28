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
