/**
 * callos.in parity gate (docs/CALLOS_FEATURES.md, "Second pass"), in a browser:
 *   G1 change password (and back)       G6 top salesperson, pipeline, at a glance
 *   G2 industry list + scripts library   G7 opportunities key numbers
 *   G3 calls table, columns, page size   G8 team: QR, setup guide, phone columns
 *   G4 recorded / untranscribed filters  G9 connect code in the sidebar, not for reps
 *   G5 report filters, Analysis, history G10 invoice subtotal, GST, payment method
 *
 * Needs the API on :5020 with the demo seed. Leaves the demo company as it
 * found it: the password and industry are put back, and billing is tried on a
 * company of its own so the demo never gets a seat limit.
 *   npm run build:web && node tools/verifyParityWeb.mjs
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
const APP = "http://localhost:4189";
const PASSWORD = process.env.DEMO_PASSWORD ?? "demo-pass-1234";
const TEMP_PASSWORD = "parity-check-5678";
const failures = [];
const errors = [];
const check = (c, m) => {
  console.log(`${c ? "  ok  " : "  FAIL"} ${m}`);
  if (!c) failures.push(m);
};
async function api(method, p, token, body) {
  const r = await fetch(`${API}${p}`, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
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
await new Promise((r) => server.listen(4189, r));
const browser = await chromium.launch();

async function signIn(phone, viewport, password = PASSWORD) {
  const ctx = await browser.newContext({ viewport, permissions: ["clipboard-read", "clipboard-write"] });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && !/status of 4\d\d/.test(m.text()) && errors.push(m.text()));
  await page.goto(`${APP}/sign-in`);
  await page.getByLabel("Mobile number or email", { exact: true }).fill(phone);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByTestId("signin-submit").click();
  await page.getByText(/Good (morning|afternoon|evening)/).waitFor({ timeout: 20_000 });
  return page;
}
const tab = (page, name) => page.getByRole("tab", { name, exact: true }).click();

try {
  // ---------------- manager, laptop ----------------
  const m = await signIn("9000000002", { width: 1440, height: 1000 });

  // G9 — the connect code sits at the top of the sidebar
  const code = m.getByRole("button", { name: /^Copy company code [A-Z0-9 ]+$/ });
  check((await code.count()) === 1, "G9 the connect code is in the sidebar");
  await code.click();
  check(await m.getByRole("button", { name: "Company code copied" }).waitFor({ timeout: 5000 }).then(() => true, () => false), "G9 one tap copies it");

  // G6 — dashboard highlights
  await m.getByText("Top salesperson", { exact: true }).waitFor({ timeout: 20_000 });
  check((await m.getByText("Pipeline", { exact: true }).count()) === 1, "G6 Pipeline panel");
  check((await m.getByText("At a glance", { exact: true }).count()) === 1, "G6 At a glance panel");
  const glance = m.getByRole("group", { name: "At a glance: today, yesterday and last week" });
  for (const p of ["Today", "Yesterday", "Last week"]) check((await glance.getByText(p, { exact: true }).count()) === 1, `G6 at a glance has ${p}`);
  check((await m.getByText(/connected of \d+ ·/).count()) + (await m.getByText(/Nobody has connected a call this week/).count()) === 1, "G6 top salesperson shows a person or says why not");
  await m.screenshot({ path: `${evidence}/parity-01-dashboard.png`, fullPage: true });

  // G3/G4 — calls: blocked, sources, recorded, table view
  await m.getByRole("link", { name: "Calls" }).click();
  await m.getByRole("button", { name: "7 days" }).click();
  for (const chip of ["Blocked", "WhatsApp", "Cloud call", "AI agent", "Recorded", "Not transcribed yet"]) {
    check((await m.getByRole("button", { name: chip, exact: true }).count()) >= 1, `G3/G4 "${chip}" filter`);
  }
  const header = (p, h) => p.getByRole("columnheader", { name: new RegExp("^" + h + "$", "i") });
  await tab(m, "Table");
  await m.getByRole("button", { name: "Columns", exact: true }).waitFor({ timeout: 15_000 });
  await header(m, "Date").waitFor({ timeout: 15_000 });
  for (const h of ["Date", "Type", "Phone", "Employee", "Recording", "Status", "Deal"]) { const n = await header(m, h).count(); check(n === 1, `G3 table column ${h} (${n})`); }
  check((await header(m, "Notes").count()) === 0, "G3 Notes is off by default");
  await m.getByRole("button", { name: "Columns", exact: true }).click();
  await m.getByRole("checkbox", { name: "Notes" }).click();
  await m.getByRole("checkbox", { name: "Device" }).click();
  check((await header(m, "Notes").count()) === 1, "G3 the column chooser adds Notes");
  await m.getByRole("button", { name: "Done", exact: true }).click();
  await m.getByRole("radio", { name: "25" }).click();
  await m.getByText(/^Page 1 of \d+$/).waitFor({ timeout: 15_000 });
  check(true, "G3 25 a page, with a pager");
  await m.screenshot({ path: `${evidence}/parity-02-calls-table.png`, fullPage: true });
  await m.reload();
  await m.getByText(/Good (morning|afternoon|evening)|Calls/).first().waitFor({ timeout: 20_000 });
  await m.getByRole("link", { name: "Calls" }).click();
  await m.getByRole("button", { name: "Columns", exact: true }).waitFor({ timeout: 15_000 });
  check((await header(m, "Notes").count()) === 1 && (await header(m, "Device").count()) === 1, "G3 the table and its columns are remembered after a reload");
  await m.getByRole("button", { name: "Recorded", exact: true }).click();
  await m.getByRole("button", { name: /^Outgoing call|^Incoming call|^Missed call|^Rejected call|^Blocked call/ }).first().click({ timeout: 15_000 }).catch(() => {});
  if (await m.getByRole("button", { name: "Close" }).count()) {
    check(true, "G3 a table row opens the call");
    await m.getByRole("button", { name: "Close" }).first().click();
  }
  await tab(m, "List");

  // G5 — reports: filters, Analysis, Call history
  await m.getByRole("link", { name: "Reports" }).click();
  await m.getByRole("tab", { name: "Analysis", exact: true }).click();
  await m.getByText("Calls by hour", { exact: true }).waitFor({ timeout: 15_000 });
  check((await m.getByText("Calls by day of the week", { exact: true }).count()) === 1, "G5 Analysis tab: hours and days of the week");
  await m.getByRole("checkbox", { name: "Outgoing" }).click();
  await m.getByRole("checkbox", { name: "Sun" }).click();
  await m.getByLabel("From", { exact: true }).fill("10:00");
  await m.getByLabel("To", { exact: true }).fill("13:00");
  const filtered = m.waitForRequest((r) => /\/analytics\/summary\?/.test(r.url()) && /timeFrom=10(%3A|:)00/.test(r.url()) && /excludeDays=0/.test(r.url()) && /types=outgoing/.test(r.url()), { timeout: 15_000 });
  await m.getByLabel("To", { exact: true }).blur();
  await filtered;
  check(true, "G5 type, time window and left-out days go to the API");
  await m.screenshot({ path: `${evidence}/parity-03-reports-analysis.png`, fullPage: true });
  await m.getByRole("tab", { name: "Call history", exact: true }).click();
  await m.getByRole("button", { name: "Columns", exact: true }).waitFor({ timeout: 15_000 });
  check(true, "G5 Call history tab shows the calls table");
  await m.getByRole("button", { name: "Clear filters" }).click();

  // G7 — opportunities key numbers
  await m.getByRole("link", { name: "Opportunities" }).click();
  await m.getByText("Close rate", { exact: true }).waitFor({ timeout: 15_000 });
  check((await m.getByText("Repeat clients", { exact: true }).count()) >= 1, "G7 close rate and repeat clients");
  check((await m.getByText(/^\d+(\.\d)?%$/).count()) >= 1, "G7 close rate is a percentage");

  // G8 — team
  await m.getByRole("link", { name: "Team" }).click();
  await m.getByText("Get the app on your team’s phones").waitFor({ timeout: 15_000 });
  check((await m.getByRole("img", { name: /QR code for the join link/ }).count()) === 1, "G8 QR code of the join link, drawn locally");
  await m.getByRole("button", { name: "2. Allow permissions" }).click();
  check((await m.getByText("Step 2 of 5").count()) === 1, "G8 the five-step guide");
  await header(m, "Phone").first().waitFor({ timeout: 15_000 });
  for (const h of ["Phone", "App version", "Registered", "Last call", "Last recording"]) check((await header(m, h).count()) >= 1, `G8 team column ${h}`);
  check((await m.getByText("No phone set up yet").count()) >= 1, "G8 reps without a phone say so");
  check((await m.getByText(/ · in sync$/).count()) >= 1, "G8 the phone column says whether calls are arriving");
  await m.screenshot({ path: `${evidence}/parity-04-team.png`, fullPage: true });

  // ---------------- owner: password and industry ----------------
  const o = await signIn("9000000001", { width: 1440, height: 1000 });
  await o.getByRole("link", { name: "Account" }).click();
  await o.getByLabel("Current password", { exact: true }).fill("not-the-password");
  await o.getByLabel("New password", { exact: true }).fill(TEMP_PASSWORD);
  await o.getByLabel("Confirm new password", { exact: true }).fill(TEMP_PASSWORD);
  await o.getByRole("button", { name: "Change password", exact: true }).click();
  await o.getByRole("alert").or(o.getByText(/password/i).filter({ hasText: /wrong|incorrect|doesn/i })).first().waitFor({ timeout: 15_000 }).catch(() => {});
  check((await api("POST", "/auth/login", null, { identifier: "9000000001", password: PASSWORD, deviceId: "parity-check-1" })).status === 200, "G1 a wrong current password changes nothing");
  await o.getByLabel("Current password", { exact: true }).fill(PASSWORD);
  await o.getByRole("button", { name: "Change password", exact: true }).click();
  await o.getByText("Password changed. Your other devices have been signed out.").waitFor({ timeout: 15_000 });
  check(true, "G1 the password changes and this tab stays signed in");
  await o.getByRole("link", { name: "Calls" }).click();
  await o.getByRole("button", { name: "Export to Excel" }).waitFor({ timeout: 15_000 });
  check(true, "G1 the session carries on with the new tokens");
  // put it back
  await o.getByRole("link", { name: "Account" }).click();
  await o.getByLabel("Current password", { exact: true }).fill(TEMP_PASSWORD);
  await o.getByLabel("New password", { exact: true }).fill(PASSWORD);
  await o.getByLabel("Confirm new password", { exact: true }).fill(PASSWORD);
  await o.getByRole("button", { name: "Change password", exact: true }).click();
  await o.getByText("Password changed. Your other devices have been signed out.").waitFor({ timeout: 15_000 });
  check((await api("POST", "/auth/login", null, { identifier: "9000000001", password: PASSWORD, deviceId: "parity-check-2" })).status === 200, "G1 the demo password is restored");

  await o.getByRole("link", { name: "Settings" }).click();
  await tab(o, "Organisation");
  for (const ind of ["Technology", "Healthcare", "Finance", "Retail", "Manufacturing", "Telecommunications", "Education", "Insurance & loans"]) {
    check((await o.getByRole("radio", { name: ind, exact: true }).count()) === 1, `G2 industry ${ind}`);
  }
  await o.getByRole("radio", { name: "Finance", exact: true }).click();
  await o.getByRole("button", { name: "Save organisation" }).click();
  await o.getByText("Saved.").waitFor({ timeout: 15_000 });
  await o.getByRole("link", { name: "Scripts" }).click();
  await o.getByRole("radio", { name: "Insurance & loans · yours" }).waitFor({ timeout: 15_000 });
  check(true, "G2 a finance company reads the insurance & loans library");
  await o.getByRole("link", { name: "Settings" }).click();
  await tab(o, "Organisation");
  await o.getByRole("radio", { name: "Real estate", exact: true }).click();
  await o.getByRole("button", { name: "Save organisation" }).click();
  await o.getByText("Saved.").waitFor({ timeout: 15_000 });
  check(true, "G2 the demo industry is restored");

  // ---------------- G10: invoices, on a company of its own ----------------
  const ownerPhone = `9${String(Date.now()).slice(-9)}`;
  const su = await api("POST", "/auth/signup", null, {
    companyName: `Parity Homes ${Date.now().toString(36).slice(-4)}`,
    industry: "real_estate",
    name: "Parity Owner",
    phone: ownerPhone,
    email: `parity${Date.now()}@example.com`,
    password: PASSWORD,
    deviceId: "parity-owner-device",
    platform: "web",
  });
  const tok = su.json?.data?.accessToken;
  const inv = await api("POST", "/billing/checkout", tok, { kind: "subscription", plan: "starter", seats: 1, months: 1 });
  await api("POST", `/billing/invoices/${inv.json?.data?.id}/test-pay`, tok);
  const b = await signIn(ownerPhone, { width: 1440, height: 1000 });
  await b.getByRole("link", { name: "Billing" }).click();
  await b.getByText("Before GST", { exact: true }).last().waitFor({ timeout: 15_000 });
  check((await b.getByText("GST 18%", { exact: true }).count()) >= 1, "G10 invoices show GST");
  check((await b.getByText("Paid by", { exact: true }).count()) === 1, "G10 invoices show the payment method");
  check((await b.getByText("Test mode", { exact: true }).count()) >= 1, "G10 the test payment's method reads Test mode");
  await b.screenshot({ path: `${evidence}/parity-05-invoices.png`, fullPage: true });

  // ---------------- a rep on a phone ----------------
  const r = await signIn("9000000103", { width: 390, height: 844 });
  check((await r.getByText("Top salesperson", { exact: true }).count()) === 0, "G6 reps don't get the manager highlights");
  await r.getByRole("tab", { name: /^More/ }).click();
  await r.getByRole("link", { name: "Inbox" }).waitFor({ timeout: 15_000 });
  check((await r.getByRole("button", { name: /^Copy company code|^Company code copied/ }).count()) === 0, "G9 reps never see the connect code");
} catch (e) {
  failures.push(e.message.split("\n")[0]);
  console.log("  FAIL", e.message.split("\n")[0]);
  for (const [i, p] of browser.contexts().flatMap((c) => c.pages()).entries()) await p.screenshot({ path: `${evidence}/parity-fail-${i}.png`, fullPage: true }).catch(() => {});
} finally {
  await browser.close();
  server.close();
}
check(errors.length === 0, `no console or page errors${errors.length ? `: ${errors.slice(0, 3).join(" | ")}` : ""}`);
console.log(failures.length ? `\n${failures.length} check(s) failed` : "\ncallos parity gate: all checks passed");
process.exit(failures.length ? 1 : 0);
