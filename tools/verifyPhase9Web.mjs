/**
 * Phase 9 gate, in a browser: a new company on trial converts to paid —
 * Growth, 3 seats, 12 months — with the bill (and its GST) shown before
 * paying; then adds 2 seats mid-period and is billed for the days left; the
 * GST invoice downloads as a PDF; the seat limit holds; and when a plan has
 * ended, the owner gets the renew screen and a rep is told who can renew.
 *
 * The dev API has no Razorpay keys, so payment runs in test mode (the
 * signed-webhook path is covered by tests/integration/billing.int.test.js).
 *   npm run build:web && node tools/verifyPhase9Web.mjs
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
const APP = "http://localhost:4188";
const PASSWORD = "billing-gate-1234";
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
const n = () => `9${String(Date.now() + Math.floor(Math.random() * 1e6)).slice(-9)}`;

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".ttf": "font/ttf", ".json": "application/json" };
const server = http.createServer((req, res) => {
  let f = path.join(dist, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!f.startsWith(dist) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(dist, "index.html");
  res.writeHead(200, { "content-type": TYPES[path.extname(f)] ?? "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(4188, r));
const browser = await chromium.launch();

async function signIn(phone, viewport, { expired = false } = {}) {
  const ctx = await browser.newContext({ viewport, acceptDownloads: true });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && !/status of 4\d\d/.test(m.text()) && errors.push(m.text()));
  if (expired) {
    // the server's expiry is proven in the API tests; here, the app's answer to it
    await page.route("**/api/v1/auth/me", async (route) => {
      const r = await route.fetch();
      const body = await r.json();
      body.data.company.subscription = { ...body.data.company.subscription, status: "expired", daysLeft: 0 };
      await route.fulfill({ response: r, json: body });
    });
    await page.route("**/api/v1/billing", async (route) => {
      const r = await route.fetch();
      const body = await r.json();
      if (body.data) body.data.subscription = { ...body.data.subscription, status: "expired", daysLeft: 0 };
      await route.fulfill({ response: r, json: body });
    });
  }
  await page.goto(`${APP}/sign-in`);
  await page.getByLabel("Mobile number or email", { exact: true }).fill(phone);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByTestId("signin-submit").click();
  return { ctx, page };
}

try {
  // a company that signed up today, with two reps
  const ownerPhone = n();
  const su = await api("POST", "/auth/signup", null, {
    companyName: `Shela Homes ${Date.now().toString(36).slice(-4)}`,
    industry: "real_estate",
    name: "Nisha Owner",
    phone: ownerPhone,
    email: `nisha${Date.now()}@example.com`,
    password: PASSWORD,
    deviceId: "billing-gate-owner",
    platform: "web",
  });
  check(su.status === 201, "a new company signs up (on trial)");
  const code = su.json.data.company.code;
  const repPhones = [];
  for (let i = 0; i < 2; i++) {
    const p = n();
    repPhones.push(p);
    await api("POST", "/auth/join", null, { code, name: `Rep ${i + 1}`, phone: p, password: PASSWORD, deviceId: `billing-gate-rep-${i}`, platform: "android" });
  }

  const { page: o } = await signIn(ownerPhone, { width: 1440, height: 1000 });
  await o.getByText(/left in your free trial/).waitFor({ timeout: 20_000 });
  check(true, "Home shows the trial and a way to choose a plan");
  await o.getByRole("button", { name: "Choose a plan" }).click();
  await o.getByText(/^Free trial · 1[34] days left$/).waitFor({ timeout: 15_000 });
  check((await o.getByText("3 members — the trial has no seat limit").count()) === 1, "billing shows the trial and the 3 members");

  await o.getByRole("radio", { name: /^Growth, ₹99 per user per month plus ₹299 per month$/ }).click();
  await o.getByRole("radio", { name: "12 months" }).click();
  // (₹99 × 3 + ₹299) × 12 = ₹7,152 + 18% GST = ₹8,439.36
  await o.getByLabel("Total ₹8,439.36").waitFor({ timeout: 15_000 });
  check((await o.getByText("CGST 9% + SGST 9%").count()) === 1, "the bill shows ₹8,439.36 with GST split, before paying");
  await o.screenshot({ path: `${evidence}/p9-01-choose-plan.png`, fullPage: true });

  await o.getByRole("button", { name: "Pay ₹8,439.36" }).click();
  await o.getByText("Waiting for payment · ₹8,439.36").waitFor({ timeout: 15_000 });
  await o.getByRole("button", { name: "Mark as paid (test)" }).click();
  await o.getByText("Payment received").waitFor({ timeout: 15_000 });
  await o.getByText("Growth · 3 seats").waitFor({ timeout: 15_000 });
  check(true, "paid: the company is on Growth with 3 seats");
  const year = new Date().getFullYear() + 1;
  check((await o.getByText(new RegExp(String.raw`^Paid till \d+ \w+ ${year}\.`)).count()) === 1, `a year's plan is paid till next year (${year})`);
  check((await o.getByText("3 of 3 seats in use").count()) === 1, "all 3 seats are in use");

  // the seat limit holds
  const extra = await api("POST", "/auth/join", null, { code, name: "Rep 3", phone: n(), password: PASSWORD, deviceId: "billing-gate-rep-3", platform: "android" });
  check(extra.status === 402 && extra.json.error.code === "SEATS_FULL", "a fourth person can't join: seats are full");

  // two more seats, mid-period: billed for the days left
  await o.getByRole("button", { name: "One seat more" }).click();
  await o.getByRole("button", { name: "One seat more" }).click();
  await o.getByText(/^2 more users — \d+ days left of this period$/).waitFor({ timeout: 15_000 });
  const total = await o.getByLabel(/^Total ₹/).getAttribute("aria-label");
  const rupees = Number(total.replace(/[^\d.]/g, ""));
  // 2 seats × ₹99 × 12 months × ~365/365 + GST ≈ ₹2,803
  check(rupees > 2_700 && rupees <= 2_804, `adding 2 seats for the rest of the year costs ${total.replace("Total ", "")}`);
  await o.screenshot({ path: `${evidence}/p9-02-add-seats.png`, fullPage: true });
  await o.getByRole("button", { name: /^Pay ₹/ }).click();
  await o.getByRole("button", { name: "Mark as paid (test)" }).click();
  await o.getByText("Growth · 5 seats").waitFor({ timeout: 15_000 });
  check(true, "the seats are added at once");
  const joined = await api("POST", "/auth/join", null, { code, name: "Rep 3", phone: n(), password: PASSWORD, deviceId: "billing-gate-rep-3b", platform: "android" });
  check(joined.status === 201, "and the next person can join");

  // the GST invoices
  const pdfs = o.getByRole("button", { name: "PDF" });
  check((await pdfs.count()) === 2, "two paid invoices are listed");
  const [dl] = await Promise.all([o.waitForEvent("download", { timeout: 15_000 }), pdfs.first().click()]);
  const file = path.join(evidence, "p9-invoice.pdf");
  await dl.saveAs(file);
  check(/^RW-\d{4}-\d{2}-\d{4}\.pdf$/.test(dl.suggestedFilename()) && fs.readFileSync(file).subarray(0, 4).toString() === "%PDF", `the GST invoice downloads (${dl.suggestedFilename()})`);
  await o.screenshot({ path: `${evidence}/p9-03-paid.png`, fullPage: true });

  // a plan that has ended: the owner can renew right there; a rep is told who can
  const { page: oe } = await signIn(ownerPhone, { width: 1440, height: 1000 }, { expired: true });
  await oe.getByText("Your plan has ended").waitFor({ timeout: 20_000 });
  check((await oe.getByRole("link", { name: "Calls" }).count()) === 0, "an ended plan hides the app and shows the owner the renew screen");
  await oe.screenshot({ path: `${evidence}/p9-04-owner-renew.png` });
  const { page: re } = await signIn(repPhones[0], { width: 390, height: 844 }, { expired: true });
  await re.getByText("The plan has ended").waitFor({ timeout: 20_000 });
  check((await re.getByText(/Ask the account owner/).count()) === 1, "a rep is told the owner can renew");
  await re.screenshot({ path: `${evidence}/p9-05-rep-ended.png` });
} catch (e) {
  failures.push(e.message.split("\n")[0]);
  console.log("  FAIL", e.message.split("\n")[0]);
  for (const [i, p] of browser.contexts().flatMap((c) => c.pages()).entries()) await p.screenshot({ path: `${evidence}/p9-fail-${i}.png`, fullPage: true }).catch(() => {});
} finally {
  await browser.close();
  server.close();
}
check(errors.length === 0, `no console or page errors${errors.length ? `: ${errors.slice(0, 3).join(" | ")}` : ""}`);
console.log(failures.length ? `\n${failures.length} check(s) failed` : "\nPhase 9 web gate: all checks passed");
process.exit(failures.length ? 1 : 0);
