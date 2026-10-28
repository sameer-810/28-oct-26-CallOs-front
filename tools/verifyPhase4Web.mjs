/**
 * Phase 4, the parts a browser can prove (the phone side needs a phone):
 *   a rep's phone reports in and uploads a real recording through the API;
 *   the manager sees the phone on Team, opens the call, presses play, and the
 *   recording actually plays — the playhead moves.
 *
 * Against the demo company (SEED_DEMO_ON_BOOT=true). API on :5020.
 *   npm run build:web && node tools/verifyPhase4Web.mjs
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(here, "../dist");
const evidence = path.resolve(here, "evidence");
fs.mkdirSync(evidence, { recursive: true });
const API = "http://localhost:5020/api/v1";
const PASSWORD = process.env.DEMO_PASSWORD ?? "demo-pass-1234";
const failures = [];
const errors = [];
const check = (c, m) => {
  console.log(`${c ? "  ok  " : "  FAIL"} ${m}`);
  if (!c) failures.push(m);
};

/** A real, playable 4-second 440 Hz WAV. */
function wav(seconds = 4, rate = 8000) {
  const n = seconds * rate;
  const b = Buffer.alloc(44 + n * 2);
  b.write("RIFF", 0);
  b.writeUInt32LE(36 + n * 2, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 440 * i) / rate) * 8000), 44 + i * 2);
  return b;
}

async function api(method, p, token, body) {
  const r = await fetch(`${API}${p}`, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body && !(body instanceof FormData) ? { "content-type": "application/json" } : {}) },
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, json: await r.json().catch(() => null) };
}

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".ttf": "font/ttf", ".json": "application/json" };
const server = http.createServer((req, res) => {
  let f = path.join(dist, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!f.startsWith(dist) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(dist, "index.html");
  res.writeHead(200, { "content-type": TYPES[path.extname(f)] ?? "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(4183, r));
const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });

try {
  // ---- the rep's phone, through the API ----
  const login = await api("POST", "/auth/login", null, { identifier: "9000000101", password: PASSWORD, deviceId: "verify-phone-0001" });
  const repToken = login.json.data.accessToken;
  const repName = login.json.data.user.name;
  const report = await api("PUT", "/devices/me", repToken, {
    deviceId: "verify-phone-0001",
    brand: "Redmi",
    model: "Note 13",
    androidVersion: "14",
    simSlot: 0,
    simLabel: "Jio",
    simNumber: null,
    simConfirmed: true,
    permissions: { callLog: true, phoneState: true, recordings: true, notifications: true },
  });
  check(report.status === 200 && report.json.data.simVerified, "the phone reports in and its confirmed SIM is verified");

  const calls = await api("GET", "/calls?range=last7&limit=200&sort=longest", repToken);
  const target = calls.json.data.find((c) => c.recording.status === "none" && c.durationSec > 0);
  check(Boolean(target), "the rep has a call without a recording");
  const form = new FormData();
  form.append("file", new Blob([wav()], { type: "audio/wav" }), "call.wav");
  const up = await api("POST", `/calls/${target.id}/recording`, repToken, form);
  check(up.status === 201, "the phone uploads a real recording");

  // ---- the manager, in a browser ----
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const m = await ctx.newPage();
  m.on("pageerror", (e) => errors.push(e.message));
  m.on("console", (msg) => msg.type() === "error" && !/status of 4\d\d/.test(msg.text()) && errors.push(msg.text()));
  await m.goto("http://localhost:4183/sign-in");
  await m.getByLabel("Mobile number or email", { exact: true }).fill("9000000002");
  await m.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await m.getByTestId("signin-submit").click();
  await m.getByText(/Good (morning|afternoon|evening)/).waitFor({ timeout: 20_000 });

  await m.getByRole("link", { name: "Team" }).click();
  await m.getByText("Redmi Note 13 · Jio · in sync").waitFor({ timeout: 15_000 });
  check(true, `Team shows ${repName}'s phone as in sync`);
  check((await m.getByText("No phone set up yet").count()) > 0, "reps without a phone are shown as such");
  await m.screenshot({ path: `${evidence}/p4-01-team-devices.png`, fullPage: true });

  await m.getByRole("link", { name: "Calls" }).click();
  await m.getByRole("button", { name: "7 days" }).click();
  await m.getByPlaceholder("Name, number or a word from the notes").fill(target.phone.replace(/^\+91/, ""));
  await m.getByRole("button", { name: new RegExp(`call, `) }).first().waitFor({ timeout: 15_000 });
  // open the very call that has the recording
  const rows = m.getByRole("button", { name: /call, / });
  const count = await rows.count();
  let opened = false;
  for (let i = 0; i < count && !opened; i++) {
    await rows.nth(i).click();
    await m.getByText("How did it go?").waitFor();
    if (await m.getByRole("button", { name: /^Play recording/ }).count()) opened = true;
    else await m.getByRole("button", { name: "Close" }).last().click();
  }
  check(opened, "the call shows its recording");
  await m.getByRole("button", { name: /^Play recording/ }).click();
  await m.getByRole("button", { name: "Pause recording" }).waitFor({ timeout: 15_000 });
  await m.waitForTimeout(2500);
  const pos = await m.getByRole("slider").getAttribute("aria-label");
  const secs = Number(/Position \d+:(\d\d)/.exec(pos ?? "")?.[1] ?? 0);
  check(secs >= 1, `the recording plays — playhead at ${pos}`);
  await m.screenshot({ path: `${evidence}/p4-02-recording-playing.png` });
} catch (e) {
  failures.push(e.message.split("\n")[0]);
  console.log("  FAIL", e.message.split("\n")[0]);
  for (const [i, p] of browser.contexts().flatMap((c) => c.pages()).entries()) await p.screenshot({ path: `${evidence}/p4-fail-${i}.png`, fullPage: true }).catch(() => {});
} finally {
  await browser.close();
  server.close();
}
check(errors.length === 0, `no console or page errors${errors.length ? `: ${errors.slice(0, 3).join(" | ")}` : ""}`);
console.log(failures.length ? `\n${failures.length} check(s) failed` : "\nPhase 4 web gate: all checks passed");
process.exit(failures.length ? 1 : 0);
