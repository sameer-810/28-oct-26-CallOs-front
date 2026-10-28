/**
 * Phase 8 gate, in a browser: a manager comments on minute 2:10 of a rep's
 * recorded call; the rep, on a phone, sees the inbox badge, opens the
 * notification and lands on that call with the recording at 2:10 and the
 * comment marked; a WhatsApp follow-up fills in the lead's name and opens
 * wa.me with it; the rep replies and the manager is told. The script library
 * can be turned into the company's own by a manager, and only read by a rep.
 *
 * Needs the API on :5020 with the demo seed.
 *   npm run build:web && node tools/verifyPhase8Web.mjs
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
const APP = "http://localhost:4187";
const PASSWORD = process.env.DEMO_PASSWORD ?? "demo-pass-1234";
const REP_PHONE = "9000000103";
const failures = [];
const errors = [];
const check = (c, m) => {
  console.log(`${c ? "  ok  " : "  FAIL"} ${m}`);
  if (!c) failures.push(m);
};

/** A playable 440 Hz WAV as long as the call. */
function wav(seconds, rate = 8000) {
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
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 440 * i) / rate) * 3000), 44 + i * 2);
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
await new Promise((r) => server.listen(4187, r));
const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });

async function signIn(phone, viewport) {
  const ctx = await browser.newContext({ viewport });
  // WhatsApp is the outside world; answer for it
  await ctx.route("https://wa.me/**", (r) => r.fulfill({ status: 200, contentType: "text/html", body: "<title>wa</title>" }));
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && !/status of 4\d\d|wa\.me/.test(m.text()) && errors.push(m.text()));
  await page.goto(`${APP}/sign-in`);
  await page.getByLabel("Mobile number or email", { exact: true }).fill(phone);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByTestId("signin-submit").click();
  await page.getByText(/Good (morning|afternoon|evening)/).waitFor({ timeout: 20_000 });
  return { ctx, page };
}

try {
  // ---- a recorded call of the rep's, through the API ----
  const login = await api("POST", "/auth/login", null, { identifier: REP_PHONE, password: PASSWORD, deviceId: "verify-phone-0008" });
  const repToken = login.json.data.accessToken;
  const repName = login.json.data.user.name;
  const calls = await api("GET", "/calls?range=last30&limit=200&sort=longest", repToken);
  const target = calls.json.data.find((c) => c.type === "outgoing" && c.durationSec >= 150 && c.durationSec <= 600 && c.contactName);
  check(Boolean(target), `${repName} has a long call with a named lead`);
  if (target.recording.status !== "uploaded") {
    const form = new FormData();
    form.append("file", new Blob([wav(target.durationSec)], { type: "audio/wav" }), "call.wav");
    const up = await api("POST", `/calls/${target.id}/recording`, repToken, form);
    check(up.status === 201, "the call's recording is uploaded");
  }
  const lead = target.contactName.split(" ")[0];
  const before = (await api("GET", "/notifications/unread-count", repToken)).json.data.count;

  // ---- the manager comments at 2:10 ----
  const { page: m } = await signIn("9000000002", { width: 1440, height: 900 });
  await m.goto(`${APP}/calls?open=${target.id}`);
  await m.getByText("Review", { exact: true }).waitFor({ timeout: 20_000 });
  const note = `At this point ask the budget before quoting the price. (${Date.now().toString(36)})`;
  await m.getByLabel("Your comment", { exact: true }).fill(note);
  await m.getByLabel("Moment in the call", { exact: true }).fill("2:10");
  await Promise.all([
    m.waitForResponse((r) => r.request().method() === "POST" && r.url().endsWith(`/calls/${target.id}/comments`) && r.status() === 201, { timeout: 15_000 }),
    m.getByRole("button", { name: "Comment", exact: true }).click(),
  ]);
  await m.getByText(note).waitFor({ timeout: 10_000 });
  check((await m.getByRole("button", { name: "Play from 2:10" }).count()) >= 1, "the comment is pinned to 2:10");
  await m.screenshot({ path: `${evidence}/p8-01-manager-comment.png` });
  const after = (await api("GET", "/notifications/unread-count", repToken)).json.data.count;
  check(after === before + 1, `the rep has one more unread notification (${before} → ${after})`);

  // ---- the rep, on a phone ----
  const { page: r, ctx: rctx } = await signIn(REP_PHONE, { width: 390, height: 844 });
  await r.getByRole("tab", { name: /^More, \d+ unread$/ }).waitFor({ timeout: 20_000 });
  check(true, "the phone's More tab carries the unread count");
  await r.getByRole("tab", { name: /^More/ }).click();
  await r.getByRole("link", { name: "Inbox" }).click();
  const row = r.getByRole("button", { name: new RegExp(`commented at 2:10 on the call with ${target.contactName}`) }).first();
  await row.waitFor({ timeout: 15_000 });
  check((await row.getAttribute("aria-label")).startsWith("Unread."), "the notification is unread, says who, where and which call");
  await r.screenshot({ path: `${evidence}/p8-02-rep-inbox.png` });
  await row.click();

  await r.getByTestId("focused-comment").waitFor({ timeout: 20_000 });
  check((await r.getByTestId("focused-comment").getByText(note).count()) === 1, "the call opens with the manager's comment marked");
  const pos = r.getByLabel(/^Position \d+:\d\d of \d+:\d\d$/);
  await pos.waitFor({ timeout: 20_000 });
  await r.waitForFunction(
    () => {
      const el = [...document.querySelectorAll("[aria-label^='Position ']")][0];
      const m = el && /^Position (\d+):(\d\d)/.exec(el.getAttribute("aria-label"));
      return m && Number(m[1]) * 60 + Number(m[2]) >= 129;
    },
    null,
    { timeout: 20_000 },
  );
  const label = await pos.getAttribute("aria-label");
  const [mm, ss] = /^Position (\d+):(\d\d)/.exec(label).slice(1).map(Number);
  check(mm * 60 + ss >= 129 && mm * 60 + ss <= 140, `the recording plays from 2:10 (${label})`);
  await r.screenshot({ path: `${evidence}/p8-03-rep-call-at-moment.png` });
  // reading it cleared the badge
  await r.waitForTimeout(800);
  check((await api("GET", "/notifications/unread-count", repToken)).json.data.count === before, "opening it marks it read");

  // ---- WhatsApp follow-up with the lead's name ----
  await r.getByRole("radio", { name: "Tried calling you" }).scrollIntoViewIfNeeded();
  await r.getByRole("radio", { name: "Tried calling you" }).click();
  const msg = await r.getByLabel("WhatsApp message", { exact: true }).inputValue();
  check(msg.startsWith(`Hi ${lead}, `) && msg.includes(repName.split(" ")[0]) && !/\{\w+\}/.test(msg), `the template is filled in: "${msg.split("\n")[0].slice(0, 60)}…"`);
  const [wa] = await Promise.all([rctx.waitForEvent("page", { timeout: 10_000 }), r.getByRole("button", { name: "Open WhatsApp" }).click()]);
  const url = new URL(wa.url());
  check(url.host === "wa.me" && url.pathname === `/${target.phone.replace(/\D/g, "")}` && url.searchParams.get("text") === msg.trim(), "WhatsApp opens to the lead with the message typed out");
  await wa.close();
  await r.getByRole("radio", { name: "Thanks for your time" }).click();
  const withDate = await r.getByLabel("WhatsApp message", { exact: true }).inputValue();
  if (/\{date\}/.test(withDate)) {
    check((await r.getByRole("button", { name: "Open WhatsApp" }).getAttribute("aria-disabled")) === "true", "a message with an unfilled {date} can't be sent until it's typed in");
  }
  await r.screenshot({ path: `${evidence}/p8-04-rep-whatsapp.png` });

  // ---- the rep replies; the manager hears ----
  await r.getByLabel("Your comment", { exact: true }).fill("Got it — I'll ask the budget first next time.");
  await Promise.all([
    r.waitForResponse((x) => x.request().method() === "POST" && x.url().endsWith(`/calls/${target.id}/comments`) && x.status() === 201, { timeout: 15_000 }),
    r.getByRole("button", { name: "Reply", exact: true }).click(),
  ]);
  await m.reload();
  await m.getByRole("link", { name: /^Inbox, \d+ unread$/ }).waitFor({ timeout: 20_000 });
  check(true, "the manager's sidebar shows the reply as unread");

  // ---- scripts: the rep reads, the manager adopts one ----
  await r.goto(`${APP}/scripts`);
  await r.getByText("What to say").waitFor({ timeout: 15_000 });
  await r.getByText("\"Price is too high\"", { exact: true }).waitFor({ timeout: 15_000 });
  check((await r.getByRole("radio", { name: "Real estate · yours" }).getAttribute("aria-checked")) === "true", "the rep sees the library for the company's industry");
  check((await r.getByRole("button", { name: "New script" }).count()) === 0 && (await r.getByRole("button", { name: "Make it ours" }).count()) === 0, "a rep can read and copy, not edit");
  await r.screenshot({ path: `${evidence}/p8-05-rep-scripts.png`, fullPage: true });

  await m.getByRole("link", { name: "Scripts" }).click();
  await m.getByText("What to say").waitFor({ timeout: 15_000 });
  await m.getByRole("radio", { name: "Objections" }).click();
  const adopt = m.getByRole("button", { name: "Make it ours" }).first();
  await adopt.click();
  const title = `Price objection — Shela (${Date.now().toString(36).slice(-4)})`;
  await m.getByLabel("Title", { exact: true }).fill(title);
  await Promise.all([
    m.waitForResponse((x) => x.request().method() === "POST" && x.url().endsWith("/playbook") && x.status() === 201, { timeout: 15_000 }),
    m.getByRole("button", { name: "Save", exact: true }).click(),
  ]);
  await m.getByText(title).waitFor({ timeout: 10_000 });
  check(true, "a manager turns a library script into the company's own");
  await m.screenshot({ path: `${evidence}/p8-06-manager-scripts.png`, fullPage: true });
  await m.getByRole("button", { name: "Delete", exact: true }).first().click();
  await Promise.all([
    m.waitForResponse((x) => x.request().method() === "DELETE" && /\/playbook\/[0-9a-f]{24}$/.test(x.url()) && x.status() === 204, { timeout: 15_000 }),
    m.getByRole("button", { name: "Delete", exact: true }).last().click(),
  ]);
  check(true, "and deletes it");
} catch (e) {
  failures.push(e.message.split("\n")[0]);
  console.log("  FAIL", e.message.split("\n")[0]);
  for (const [i, p] of browser.contexts().flatMap((c) => c.pages()).entries()) await p.screenshot({ path: `${evidence}/p8-fail-${i}.png`, fullPage: true }).catch(() => {});
} finally {
  await browser.close();
  server.close();
}
check(errors.length === 0, `no console or page errors${errors.length ? `: ${errors.slice(0, 3).join(" | ")}` : ""}`);
console.log(failures.length ? `\n${failures.length} check(s) failed` : "\nPhase 8 web gate: all checks passed");
process.exit(failures.length ? 1 : 0);
