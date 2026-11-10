import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSimBatch,
  followupAlarms,
  onWorkSims,
  provedSlots,
  simsChanged,
  whatsAppToApiCall,
  type WorkSim,
} from "../src/modules/device/syncRules";
import { phoneChecks } from "../src/modules/device/phoneChecks";

const SETUP = Date.UTC(2026, 10, 10, 6, 0);
const sim = (over: Partial<WorkSim> = {}): WorkSim => ({ slot: 0, carrier: "Jio", number: "9876511111", configuredAt: SETUP, verifiedAt: null, ...over });
const row = (over: Record<string, unknown> = {}) => ({
  id: "1",
  number: "+919876543210",
  type: 2,
  date: SETUP + 60_000,
  duration: 40,
  name: "",
  simSlot: 0 as number | null,
  ...over,
});

test("only calls on a set-up SIM, made after it was set up, are work calls", () => {
  const sims = [sim(), sim({ slot: 1, carrier: "Airtel", configuredAt: SETUP + 3600_000 })];
  assert.equal(onWorkSims(row(), sims, 2), true);
  assert.equal(onWorkSims(row({ date: SETUP - 1 }), sims, 2), false, "before setup");
  assert.equal(onWorkSims(row({ simSlot: 1 }), sims, 2), false, "SIM 2 was set up an hour later");
  assert.equal(onWorkSims(row({ simSlot: 1, date: SETUP + 2 * 3600_000 }), sims, 2), true);
  assert.equal(onWorkSims(row({ simSlot: 2 }), sims, 3), false, "a SIM nobody set up");
  assert.equal(onWorkSims(row({ simSlot: null }), sims, 2), false, "untagged on a dual-SIM phone");
  assert.equal(onWorkSims(row({ simSlot: null }), [sim()], 1), true, "untagged on a single-SIM phone");
  assert.equal(onWorkSims(row(), [], 1), false, "nothing set up yet");
});

test("the batch labels each call with its SIM and skips duplicates", () => {
  const sims = [sim(), sim({ slot: 1, carrier: "" })];
  const batch = buildSimBatch([row({ id: "2", simSlot: 1, date: SETUP + 120_000 }), row(), row()], sims, 2);
  assert.equal(batch.length, 2);
  assert.deepEqual(batch.map((c) => c.simLabel), ["Jio", "SIM 2"]);
});

test("an outgoing call after setup proves the SIM; incoming or earlier ones don't", () => {
  const sims = [sim(), sim({ slot: 1 }), sim({ slot: 2, verifiedAt: SETUP })];
  assert.deepEqual(provedSlots([row({ type: 1 }), row({ simSlot: 1, date: SETUP - 5 })], sims), []);
  assert.deepEqual(provedSlots([row(), row({ simSlot: 2 })], sims), [0]);
});

test("a set-up SIM missing from the phone means setup again", () => {
  assert.equal(simsChanged([sim(), sim({ slot: 1 })], [{ slot: 0 }, { slot: 1 }]), false);
  assert.equal(simsChanged([sim(), sim({ slot: 1 })], [{ slot: 0 }]), true);
});

test("WhatsApp calls: need a number; missed carries no talk time", () => {
  const w = { id: "wa-1", type: "outgoing" as const, number: "+91 98765 43210", name: "Priya", startedAt: SETUP, durationSec: 75 };
  const c = whatsAppToApiCall(w);
  assert.equal(c?.source, "whatsapp");
  assert.equal(c?.simLabel, "WhatsApp");
  assert.equal(c?.durationSec, 75);
  assert.equal(whatsAppToApiCall({ ...w, type: "missed" })?.durationSec, 0);
  assert.equal(whatsAppToApiCall({ ...w, number: null }), null);
  assert.equal(whatsAppToApiCall({ ...w, number: "Priya" }), null);
});

test("follow-up alarms: my open ones ahead only", () => {
  const now = SETUP;
  const at = new Date(SETUP + 86_400_000).toISOString();
  const base = { id: "c1", userId: "me", phone: "+919876543210", contactName: "Priya", followUpAt: at, followUpDone: false, leadStatusLabel: "Hot" };
  const alarms = followupAlarms(
    [base, { ...base, id: "c2", userId: "someone" }, { ...base, id: "c3", followUpDone: true }, { ...base, id: "c4", followUpAt: new Date(now - 1).toISOString() }],
    "me",
    now,
  );
  assert.equal(alarms.length, 1);
  assert.equal(alarms[0].title, "Follow up: Priya");
  assert.match(alarms[0].text, /Hot/);
  assert.equal(alarms[0].phone, "+919876543210");
});

test("the setup checklist: 8 checks; auto-start counts once confirmed or not needed", () => {
  const perms = { callLog: true, phoneState: true, phoneNumbers: true, recordings: false, notifications: true, contacts: true, callPhone: true };
  const health = { battery: false, overlay: false, whatsapp: false, autostartNeeded: true, recordingFolder: false, power: { level: 50, charging: false, powerSave: false } };
  const r = phoneChecks(perms, health, { autostartConfirmed: false, recordingFolderSeen: false });
  assert.equal(r.items.length, 8);
  assert.equal(r.passing, 3);
  assert.equal(r.items.find((i) => i.key === "autostart")?.ok, false);
  const done = phoneChecks(
    { ...perms, recordings: true },
    { ...health, battery: true, overlay: true, recordingFolder: true, autostartNeeded: false },
    { autostartConfirmed: false, recordingFolderSeen: false },
  );
  assert.equal(done.passing, 8);
  // a folder the media index already finds recordings in needs no manual pick
  const seen = phoneChecks(perms, health, { autostartConfirmed: true, recordingFolderSeen: true });
  assert.equal(seen.items.find((i) => i.key === "recordingFolder")?.ok, true);
  assert.equal(seen.items.find((i) => i.key === "autostart")?.ok, true);
  assert.equal(seen.report.whatsapp, false);
});
