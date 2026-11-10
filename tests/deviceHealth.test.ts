import test from "node:test";
import assert from "node:assert/strict";
import { deviceHealth, type DeviceInfo } from "../src/modules/device/deviceHealthRules";

const NOW = Date.UTC(2026, 9, 27, 12, 0);
const ok: DeviceInfo = {
  id: "d",
  userId: "u",
  name: "Ankit",
  brand: "Redmi",
  model: "Note 13",
  androidVersion: "14",
  simLabel: "Jio",
  simVerified: true,
  permissions: { callLog: true, phoneState: true, recordings: true, notifications: true },
  recordingFolder: "MIUI/sound_recorder/call_rec",
  lastSyncAt: new Date(NOW - 5 * 60_000).toISOString(),
  lastCallAt: null,
};

test("a healthy phone says so", () => {
  assert.deepEqual(deviceHealth(ok, NOW), { text: "Redmi Note 13 · Jio · in sync", tone: "tertiary" });
});

test("no phone is not an alarm, just a fact", () => {
  assert.equal(deviceHealth(undefined, NOW).tone, "tertiary");
});

test("the call log being off is the worst thing, and said first", () => {
  const d = { ...ok, simVerified: false, permissions: { ...ok.permissions, callLog: false } };
  assert.match(deviceHealth(d, NOW).text, /call log access is off/);
  assert.equal(deviceHealth(d, NOW).tone, "missed");
});

test("a phone gone quiet for hours or days is flagged", () => {
  assert.match(deviceHealth({ ...ok, lastSyncAt: new Date(NOW - 8 * 3600_000).toISOString() }, NOW).text, /8 h/);
  assert.match(deviceHealth({ ...ok, lastSyncAt: new Date(NOW - 3 * 86_400_000).toISOString() }, NOW).text, /3 days/);
  assert.match(deviceHealth({ ...ok, lastSyncAt: null }, NOW).text, /ever/);
});

test("an unverified SIM is flagged; missing recordings only noted", () => {
  assert.equal(deviceHealth({ ...ok, simVerified: false }, NOW).tone, "missed");
  const noRec = deviceHealth({ ...ok, permissions: { ...ok.permissions, recordings: false } }, NOW);
  assert.equal(noRec.tone, "tertiary");
  assert.match(noRec.text, /recordings not shared/);
});

test("the phone's own checklist and battery reach the manager, after the hard failures", () => {
  const checks = { callLog: true, recordings: true, contacts: true, notifications: true, battery: true, overlay: true, autostart: true, recordingFolder: true, whatsapp: false };
  const base = { ...ok, sims: [], checks, battery: null, appVersion: "0.1.0" };
  assert.equal(deviceHealth(base, NOW).text, "Redmi Note 13 · Jio · in sync");
  assert.match(deviceHealth({ ...base, checks: { ...checks, battery: false } }, NOW).text, /battery saver can stop sync/);
  assert.match(deviceHealth({ ...base, checks: { ...checks, autostart: false } }, NOW).text, /auto-start is off/);
  assert.match(
    deviceHealth({ ...base, battery: { level: 14, charging: false, powerSave: true, at: new Date(NOW).toISOString() } }, NOW).text,
    /power saving on · 14%/,
  );
  const sims = [{ slot: 0, carrier: "Jio", number: "+919876511111", verifiedAt: null }];
  assert.equal(deviceHealth({ ...base, sims }, NOW).tone, "missed");
  // the call log still outranks everything
  assert.match(deviceHealth({ ...base, sims, permissions: { ...ok.permissions, callLog: false } }, NOW).text, /call log/);
});
