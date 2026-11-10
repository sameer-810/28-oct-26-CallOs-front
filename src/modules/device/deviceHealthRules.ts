/** Pure: what a manager should know about a rep's phone. Unit-tested in tests/deviceHealth.test.ts. */

import type { DeviceInfo } from "./types";

export type { DeviceInfo } from "./types";

/**
 * The one thing a manager should know about a rep's phone, worst first.
 * `tone: "missed"` means calls are probably not arriving.
 */
export function deviceHealth(d: DeviceInfo | undefined, now: number): { text: string; tone: "missed" | "tertiary" } {
  if (!d) return { text: "No phone set up yet", tone: "tertiary" };
  const phone = [d.brand, d.model].filter(Boolean).join(" ") || "Android phone";
  if (!d.permissions.callLog) return { text: `${phone} · call log access is off`, tone: "missed" };
  const since = d.lastSyncAt ? now - new Date(d.lastSyncAt).getTime() : Infinity;
  if (since > 6 * 3600_000) {
    const h = Math.floor(since / 3600_000);
    return { text: `${phone} · not heard from in ${Number.isFinite(h) ? (h >= 48 ? `${Math.floor(h / 24)} days` : `${h} h`) : "ever"}`, tone: "missed" };
  }
  if (!d.simVerified) return { text: `${phone} · work SIM not verified`, tone: "missed" };
  if (!d.permissions.recordings) return { text: `${phone} · recordings not shared`, tone: "tertiary" };
  // from the phone's own setup checklist: the settings that quietly stop background sync
  if (d.checks && !d.checks.battery) return { text: `${phone} · battery saver can stop sync`, tone: "tertiary" };
  if (d.checks && !d.checks.autostart) return { text: `${phone} · auto-start is off`, tone: "tertiary" };
  if (d.battery?.powerSave) return { text: `${phone} · power saving on${d.battery.level !== null ? ` · ${d.battery.level}%` : ""}`, tone: "tertiary" };
  const unproved = (d.sims ?? []).filter((x) => !x.verifiedAt).length;
  if (unproved) return { text: `${phone} · ${unproved} SIM${unproved === 1 ? "" : "s"} not verified`, tone: "missed" };
  return { text: `${phone} · ${d.simLabel || "SIM"} · in sync`, tone: "tertiary" };
}
