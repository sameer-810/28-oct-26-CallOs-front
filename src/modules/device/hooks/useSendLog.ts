import { useMutation } from "@tanstack/react-query";
import * as Application from "expo-application";
import { CallTracker } from "@/modules/call-tracker";
import { getDeviceId } from "@api/deviceId";
import { deviceApi } from "../api/deviceApi";
import { useDeviceStore } from "../deviceStore";
import { useSyncLog } from "../syncLog";
import { phoneChecks } from "../phoneChecks";

/** The log file: the phone, its checklist, its SIMs, then the sync log. Counts and errors only. */
function buildLog() {
  const d = useDeviceStore.getState();
  const lines: string[] = [];
  if (CallTracker) {
    const info = CallTracker.getDeviceInfo();
    const checks = phoneChecks(CallTracker.getPermissions(), CallTracker.getHealth(), d);
    lines.push(`phone: ${info.manufacturer} ${info.model} · Android ${info.androidVersion} (sdk ${info.sdkInt})`);
    lines.push(`checks: ${checks.items.map((i) => `${i.key}=${i.ok ? "ok" : "OFF"}`).join(" ")}`);
    lines.push(`sims: ${d.sims.map((s) => `slot${s.slot}${s.verifiedAt ? "✓" : "?"}`).join(" ") || `legacy slot ${d.workSlot}`}`);
  }
  lines.push(
    `sync: last ${d.lastSyncAt ? new Date(d.lastSyncAt).toISOString() : "never"} · ${d.pending.length} recordings waiting · ${d.alarms} reminders · error ${d.lastError ?? "none"}`,
  );
  lines.push("--- log ---", ...useSyncLog.getState().lines);
  return lines.join("\n");
}

/** Settings → "Send log file": the phone's own record, to support, with a reference to quote. */
export function useSendLog() {
  return useMutation({
    mutationFn: async (note: string) =>
      deviceApi.uploadLog({
        deviceId: await getDeviceId(),
        appVersion: Application.nativeApplicationVersion ?? "",
        note,
        text: buildLog(),
      }),
  });
}
