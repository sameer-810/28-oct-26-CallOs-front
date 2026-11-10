import { Platform } from "react-native";
import * as Application from "expo-application";
import { CallTracker } from "@/modules/call-tracker";
import { apiErrorMessage } from "@api/apiClient";
import { getDeviceId } from "@api/deviceId";
import { useAuthStore } from "@shared/store/useAuthStore";
import { useDeviceStore, type PendingRecording } from "./deviceStore";
import {
  buildBatch,
  buildSimBatch,
  followupAlarms,
  provedSlots,
  readFrom,
  simsChanged,
  wantsRecording,
  whatsAppToApiCall,
  MAX_RECORDING_ATTEMPTS,
  type ApiCall,
} from "./syncRules";
import { phoneChecks } from "./phoneChecks";
import { logSync } from "./syncLog";
import { deviceApi } from "./api/deviceApi";
import { callsApi } from "@modules/calls/api/callsApi";
import type { SyncResult } from "./types";


const BATCH = 500;
/** Uploads per run, so a background slot (a few seconds) is never overrun. */
const UPLOADS_PER_RUN = 8;
const PENDING_CAP = 150;

let running: Promise<SyncResult> | null = null;

async function hydrated() {
  if (!useAuthStore.persist.hasHydrated()) await useAuthStore.persist.rehydrate();
  if (!useDeviceStore.persist.hasHydrated()) await useDeviceStore.persist.rehydrate();
}

/** The phone's state, for the manager's Team screen. */
export async function reportDevice() {
  if (!CallTracker) return;
  const d = useDeviceStore.getState();
  const info = CallTracker.getDeviceInfo();
  const p = CallTracker.getPermissions();
  const sim = d.workSlot !== null ? CallTracker.getSims().find((s) => s.slot === d.workSlot) : undefined;
  const health = CallTracker.getHealth();
  const checks = phoneChecks(p, health, d);
  await deviceApi.report({
    deviceId: await getDeviceId(),
    brand: info.brand,
    model: info.model,
    androidVersion: info.androidVersion,
    appVersion: Application.nativeApplicationVersion ?? "",
    permissions: { callLog: p.callLog, phoneState: p.phoneState, recordings: p.recordings, notifications: p.notifications },
    ...(d.workSlot !== null
      ? { simSlot: d.workSlot, simLabel: d.simLabel, simNumber: sim?.number ?? null, simConfirmed: d.simConfirmed }
      : {}),
    ...(d.recordingFolder ? { recordingFolder: d.recordingFolder } : {}),
    ...(d.sims.length
      ? { sims: d.sims.map((s) => ({ slot: s.slot, carrier: s.carrier, number: s.number || null, verified: s.verifiedAt !== null })) }
      : {}),
    checks: checks.report,
    battery: { level: health.power.level, charging: health.power.charging, powerSave: health.power.powerSave },
  });
}

/** WhatsApp calls the listener saw since last time; acknowledged once the server has them. */
async function sendWhatsAppCalls(deviceId: string) {
  if (!CallTracker) return 0;
  const seen = CallTracker.pendingWhatsAppCalls();
  if (seen.length === 0) return 0;
  const calls = seen.map(whatsAppToApiCall).filter((c): c is NonNullable<typeof c> => c !== null);
  let inserted = 0;
  if (calls.length) inserted = (await deviceApi.sendCalls(deviceId, calls)).inserted;
  // the ones with no number can't ever be sent: let them go too
  CallTracker.ackWhatsAppCalls(seen.map((c) => c.id));
  logSync(`whatsapp: ${seen.length} seen, ${calls.length} sent, ${inserted} new`);
  return inserted;
}

/** The rep's follow-ups, armed as phone alarms so they ring with the app closed. */
async function armFollowups() {
  if (!CallTracker) return;
  const me = useAuthStore.getState().user?.id;
  if (!me) return;
  // only today's and later ones can ring; "all" is oldest first and a long
  // overdue backlog would fill the page before tomorrow's ever arrived
  const [today, upcoming] = await Promise.all([callsApi.followUps("today"), callsApi.followUps("upcoming")]);
  const items = [...today.items, ...upcoming.items];
  const n = CallTracker.setFollowups(followupAlarms(items, me, Date.now()));
  useDeviceStore.getState().set({ alarms: n });
}

async function uploadRecording(p: PendingRecording): Promise<"uploaded" | "not-found" | "failed"> {
  if (!CallTracker) return "failed";
  const found = await CallTracker.findRecording(p.phone, new Date(p.startedAt).getTime(), p.durationSec, p.contactName || null);
  if (!found) return "not-found";
  const ext = (found.name.match(/\.([a-z0-9]{2,5})$/i)?.[1] ?? "m4a").toLowerCase();
  const local = await CallTracker.copyToCache(found.uri, `${p.callId}.${ext}`);
  try {
    await deviceApi.uploadRecording(p.callId, { uri: local, name: `${p.callId}.${ext}`, type: found.mime || "audio/mp4" });
    if (found.folder) useDeviceStore.getState().set({ recordingFolder: found.folder, recordingFolderSeen: true });
    return "uploaded";
  } catch {
    return "failed";
  }
}

async function run(): Promise<SyncResult> {
  await hydrated();
  if (!CallTracker || Platform.OS !== "android") return { ran: false, sent: 0, inserted: 0, recordings: 0, reason: "not-android" };
  const auth = useAuthStore.getState();
  const dev = useDeviceStore.getState();
  if (!auth.refreshToken || !auth.user) return { ran: false, sent: 0, inserted: 0, recordings: 0, reason: "signed-out" };
  if (!dev.setupDone) return { ran: false, sent: 0, inserted: 0, recordings: 0, reason: "not-set-up" };

  const perms = CallTracker.getPermissions();
  if (!perms.callLog) {
    await reportDevice().catch(() => {});
    dev.set({ lastError: "Call log access was turned off. Open setup to allow it again." });
    return { ran: false, sent: 0, inserted: 0, recordings: 0, reason: "no-permission" };
  }

  const now = Date.now();
  // a swapped SIM: stop reading until setup is done again, so personal calls don't leak in
  const present = CallTracker.getSims();
  if (dev.sims.length && simsChanged(dev.sims, present)) {
    dev.set({ simChanged: true, lastError: "Your SIM changed. Set up your SIMs again to keep tracking calls." });
    logSync("sim: a set-up SIM is missing; sync paused");
    await reportDevice().catch(() => {});
    return { ran: false, sent: 0, inserted: 0, recordings: 0, reason: "sim-changed" };
  }

  const rows = await CallTracker.readCallLog(readFrom(dev.watermark, now), 2000);
  const proved = dev.sims.length ? provedSlots(rows, dev.sims) : [];
  if (proved.length) {
    dev.set({ sims: dev.sims.map((s) => (proved.includes(s.slot) ? { ...s, verifiedAt: now } : s)) });
    logSync(`sim: slot ${proved.join(",")} proved by a test call`);
  }
  const batch = dev.sims.length
    ? buildSimBatch(rows, useDeviceStore.getState().sims, present.length)
    : buildBatch(rows, dev.workSlot, dev.simCount, dev.simLabel);
  const byClientId = new Map<string, ApiCall>(batch.map((c) => [c.clientCallId, c]));
  const deviceId = await getDeviceId();

  let inserted = 0;
  const pending = new Map(dev.pending.map((p) => [p.callId, p]));
  for (let i = 0; i < batch.length; i += BATCH) {
    const res = await deviceApi.sendCalls(deviceId, batch.slice(i, i + BATCH));
    inserted += res.inserted;
    for (const s of res.calls) {
      const c = byClientId.get(s.clientCallId);
      if (!c) continue;
      if (s.recording !== "none") pending.delete(s.id);
      else if (!pending.has(s.id) && wantsRecording({ ...c, recording: s.recording }, 0, now)) {
        pending.set(s.id, { callId: s.id, phone: c.phone, contactName: c.contactName, startedAt: c.startedAt, durationSec: c.durationSec, attempts: 0 });
      }
    }
  }

  // recordings: newest first, a few per run, given up on after a week or six tries
  let recordings = 0;
  if (perms.recordings) {
    const queue = [...pending.values()]
      .filter((p) => wantsRecording({ ...p, recording: "none" }, p.attempts, now))
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      .slice(0, UPLOADS_PER_RUN);
    for (const p of queue) {
      const r = await uploadRecording(p).catch(() => "failed" as const);
      if (r === "uploaded") {
        pending.delete(p.callId);
        recordings += 1;
      } else {
        pending.set(p.callId, { ...p, attempts: p.attempts + 1 });
      }
    }
  }
  const keep = [...pending.values()]
    .filter((p) => p.attempts < MAX_RECORDING_ATTEMPTS && now - new Date(p.startedAt).getTime() < 7 * 86_400_000)
    .slice(-PENDING_CAP);

  inserted += await sendWhatsAppCalls(deviceId).catch((e) => {
    logSync(`whatsapp: failed ${apiErrorMessage(e, "error")}`);
    return 0;
  });
  await armFollowups().catch(() => logSync("follow-ups: could not arm reminders"));

  const newest = rows.reduce((m, r) => Math.max(m, r.date), dev.watermark ?? 0);
  logSync(`sync: ${rows.length} rows read, ${batch.length} sent, ${inserted} new, ${recordings} recordings, ${keep.length} waiting`);
  useDeviceStore.getState().set({
    watermark: newest || dev.watermark,
    pending: keep,
    lastSyncAt: Date.now(),
    lastError: null,
  });
  await reportDevice().catch(() => {});
  return { ran: true, sent: batch.length, inserted, recordings };
}

/**
 * Reads new calls from the phone and sends them. Safe to call from anywhere,
 * as often as you like: concurrent calls share one run, and the server ignores
 * calls it has already seen.
 */
export function syncNow(): Promise<SyncResult> {
  if (running) return running;
  running = run()
    .catch((err) => {
      const message = apiErrorMessage(err, "Sync failed. It will try again shortly.");
      logSync(`sync: failed — ${message}`);
      useDeviceStore.getState().set({ lastError: message });
      return { ran: false, sent: 0, inserted: 0, recordings: 0, reason: "error" };
    })
    .finally(() => {
      running = null;
    });
  return running;
}
