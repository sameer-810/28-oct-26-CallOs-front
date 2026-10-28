import { Platform } from "react-native";
import * as Application from "expo-application";
import { CallTracker } from "@/modules/call-tracker";
import { apiErrorMessage } from "@api/apiClient";
import { getDeviceId } from "@api/deviceId";
import { useAuthStore } from "@shared/store/useAuthStore";
import { useDeviceStore, type PendingRecording } from "./deviceStore";
import { buildBatch, readFrom, wantsRecording, MAX_RECORDING_ATTEMPTS, type ApiCall } from "./syncRules";
import { deviceApi } from "./api/deviceApi";
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
  });
}

async function uploadRecording(p: PendingRecording): Promise<"uploaded" | "not-found" | "failed"> {
  if (!CallTracker) return "failed";
  const found = await CallTracker.findRecording(p.phone, new Date(p.startedAt).getTime(), p.durationSec, p.contactName || null);
  if (!found) return "not-found";
  const ext = (found.name.match(/\.([a-z0-9]{2,5})$/i)?.[1] ?? "m4a").toLowerCase();
  const local = await CallTracker.copyToCache(found.uri, `${p.callId}.${ext}`);
  try {
    await deviceApi.uploadRecording(p.callId, { uri: local, name: `${p.callId}.${ext}`, type: found.mime || "audio/mp4" });
    if (found.folder) useDeviceStore.getState().set({ recordingFolder: found.folder });
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
  const rows = await CallTracker.readCallLog(readFrom(dev.watermark, now), 2000);
  const batch = buildBatch(rows, dev.workSlot, dev.simCount, dev.simLabel);
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

  const newest = rows.reduce((m, r) => Math.max(m, r.date), dev.watermark ?? 0);
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
      useDeviceStore.getState().set({ lastError: apiErrorMessage(err, "Sync failed. It will try again shortly.") });
      return { ran: false, sent: 0, inserted: 0, recordings: 0, reason: "error" };
    })
    .finally(() => {
      running = null;
    });
  return running;
}
