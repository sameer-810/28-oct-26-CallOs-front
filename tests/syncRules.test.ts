import test from "node:test";
import assert from "node:assert/strict";
import { buildBatch, clientCallId, onWorkSim, readFrom, toApiCall, wantsRecording, OVERLAP_MS } from "../src/modules/device/syncRules";

const row = (over: Partial<Parameters<typeof toApiCall>[0]> = {}) => ({
  id: "101",
  number: "+919876543210",
  type: 2,
  date: Date.UTC(2026, 9, 27, 6, 30),
  duration: 95,
  name: "Rakesh Mehta",
  simSlot: 0,
  ...over,
});

test("Android call types map to ours", () => {
  assert.equal(toApiCall(row({ type: 1 }), "Work")?.type, "incoming");
  assert.equal(toApiCall(row({ type: 2 }), "Work")?.type, "outgoing");
  assert.equal(toApiCall(row({ type: 3 }), "Work")?.type, "missed");
  assert.equal(toApiCall(row({ type: 4 }), "Work")?.type, "missed");
  assert.equal(toApiCall(row({ type: 5 }), "Work")?.type, "rejected");
  assert.equal(toApiCall(row({ type: 6 }), "Work")?.type, "blocked");
  // answered on another device: not this phone's call
  assert.equal(toApiCall(row({ type: 7 }), "Work"), null);
});

test("a missed call never carries talk time", () => {
  assert.equal(toApiCall(row({ type: 3, duration: 14 }), "Work")?.durationSec, 0);
});

test("a hidden number is skipped", () => {
  assert.equal(toApiCall(row({ number: "" }), "Work"), null);
});

test("only the work SIM is read", () => {
  assert.equal(onWorkSim({ simSlot: 0 }, 0, 2), true);
  assert.equal(onWorkSim({ simSlot: 1 }, 0, 2), false);
});

test("an untagged call counts on a single-SIM phone, not on a dual-SIM one", () => {
  assert.equal(onWorkSim({ simSlot: null }, 0, 1), true);
  assert.equal(onWorkSim({ simSlot: null }, 0, 2), false);
});

test("the client id survives the log being cleared and row ids reused", () => {
  assert.notEqual(clientCallId({ id: "5", date: 1000 }), clientCallId({ id: "5", date: 2000 }));
});

test("a batch is work-SIM only, de-duplicated and oldest first", () => {
  const rows = [
    row({ id: "3", date: 3000 }),
    row({ id: "1", date: 1000 }),
    row({ id: "1", date: 1000 }),
    row({ id: "2", date: 2000, simSlot: 1 }),
  ];
  const b = buildBatch(rows, 0, 2, "Work");
  assert.deepEqual(b.map((c) => c.clientCallId), ["1-1000", "3-3000"]);
  assert.equal(b[0].simLabel, "Work");
});

test("each read overlaps the last; the first read looks back a day", () => {
  assert.equal(readFrom(100_000_000, 200_000_000), 100_000_000 - OVERLAP_MS);
  assert.equal(readFrom(null, 200_000_000), 200_000_000 - 24 * 3600_000);
});

test("recordings are chased for answered, recent calls, and not forever", () => {
  const now = Date.now();
  const recent = new Date(now - 3600_000).toISOString();
  assert.equal(wantsRecording({ durationSec: 60, startedAt: recent, recording: "none" }, 0, now), true);
  assert.equal(wantsRecording({ durationSec: 2, startedAt: recent, recording: "none" }, 0, now), false);
  assert.equal(wantsRecording({ durationSec: 60, startedAt: recent, recording: "uploaded" }, 0, now), false);
  assert.equal(wantsRecording({ durationSec: 60, startedAt: recent, recording: "none" }, 6, now), false);
  const old = new Date(now - 8 * 86_400_000).toISOString();
  assert.equal(wantsRecording({ durationSec: 60, startedAt: old, recording: "none" }, 0, now), false);
});
