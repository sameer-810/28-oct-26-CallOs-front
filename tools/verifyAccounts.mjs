/**
 * Phase 2 gate, in a real browser against the real API:
 *   owner signs up → sees the company code → a rep joins with it (second
 *   browser) → owner makes a second joiner a manager → the manager finds the
 *   rep on Team → switches them off → the rep's next request signs them out.
 *
 *   API running on :5010 (npm run dev in 27-10-26-CallOS-back), then:
 *   npm run build:web && node tools/verifyAccounts.mjs
 *
 * Screenshots land in tools/evidence/ at phone and desktop widths.
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

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".ttf": "font/ttf", ".png": "image/png", ".json": "application/json" };

/** Static server with SPA fallback, so /join/CODE loads the app. */
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(new URL(req.url, "http://x").pathname);
  let file = path.join(dist, url);
  if (!file.startsWith(dist) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    file = path.join(dist, "index.html");
  }
  res.writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(4180, r));
const BASE = "http://localhost:4180";

const stamp = Date.now().toString().slice(-7);
const phone = (n) => `9${n}${stamp}0`;
const PASSWORD = "correct horse battery";
const failures = [];
const errors = [];

function check(cond, msg) {
  console.log(`${cond ? "  ok  " : "  FAIL"} ${msg}`);
  if (!cond) failures.push(msg);
}

const browser = await chromium.launch();

async function context(width, height) {
  const ctx = await browser.newContext({ viewport: { width, height } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    // 4xx answers are part of the flow (wrong code, switched-off rep)
    if (m.type() === "error" && !/status of 4\d\d/.test(m.text())) errors.push(m.text());
  });
  return page;
}

async function fill(page, label, value) {
  await page.getByLabel(label, { exact: true }).first().fill(value);
}

async function overflow(page) {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}

try {
  // ---- owner signs up on a laptop -----------------------------------------
  const owner = await context(1366, 860);
  await owner.goto(`${BASE}/sign-up`);
  await owner.getByText("Set up your company").waitFor();
  await owner.screenshot({ path: `${evidence}/01-signup-desktop.png` });
  await fill(owner, "Company name", "Sevagiri Realty");
  await owner.getByRole("radio", { name: "Real estate" }).click();
  await fill(owner, "Your name", "Pravin Shah");
  await fill(owner, "Mobile number", phone(1));
  await fill(owner, "Work email", `owner${stamp}@example.com`);
  await fill(owner, "Password", PASSWORD);
  await owner.getByTestId("signup-submit").click();
  await owner.getByText(/Good (morning|afternoon|evening), Pravin/).waitFor({ timeout: 15_000 });
  check(true, "owner lands on Home after sign-up");

  const codeLabel = await owner.locator('[aria-label^="Company code "]').first().getAttribute("aria-label");
  const code = codeLabel.replace("Company code ", "").replace(/\s/g, "");
  check(/^[A-Z0-9]{6}$/.test(code), `Home shows the company code (${code})`);
  check(await owner.getByText(/14 days/).isVisible(), "trial days are shown to the owner");
  check((await overflow(owner)) <= 0, "Home has no horizontal overflow on desktop");
  await owner.screenshot({ path: `${evidence}/02-home-owner-desktop.png` });

  // ---- a rep joins on a phone with the join link ----------------------------
  const rep = await context(390, 844);
  await rep.goto(`${BASE}/join/${code}`);
  await rep.getByText("Sevagiri Realty").first().waitFor({ timeout: 15_000 });
  check(true, "the join link shows which company before any details are asked");
  await rep.screenshot({ path: `${evidence}/03-join-details-phone.png` });
  await fill(rep, "Your name", "Ankit Mehta");
  await fill(rep, "Mobile number", phone(2));
  await fill(rep, "Password", PASSWORD);
  await rep.getByTestId("join-submit").click();
  await rep.getByText(/Good (morning|afternoon|evening), Ankit/).waitFor({ timeout: 15_000 });
  check(!(await rep.getByText("Your team joins with").count()), "a rep is not shown the join code");
  check(!(await rep.getByRole("tab", { name: "Team" }).count()), "a rep has no Team tab");
  check((await overflow(rep)) <= 0, "rep Home has no horizontal overflow on a phone");
  await rep.screenshot({ path: `${evidence}/04-home-rep-phone.png` });

  // ---- a wrong code is refused on the code step ------------------------------
  const stranger = await context(390, 844);
  await stranger.goto(`${BASE}/join`);
  await stranger.getByLabel("Company code, 6 characters").fill("XXXXXX");
  await stranger.getByText(/No company has that code/).waitFor({ timeout: 10_000 });
  check(true, "a wrong code is refused with a readable message");
  await stranger.screenshot({ path: `${evidence}/05-join-wrong-code-phone.png` });

  // ---- a second joiner, promoted to manager by the owner -------------------
  const mgr = await context(1280, 800);
  await mgr.goto(`${BASE}/join/${code}`);
  await mgr.getByText("Sevagiri Realty").first().waitFor({ timeout: 15_000 });
  await fill(mgr, "Your name", "Meera Joshi");
  await fill(mgr, "Mobile number", phone(3));
  await fill(mgr, "Password", PASSWORD);
  await mgr.getByTestId("join-submit").click();
  await mgr.getByText(/Meera/).first().waitFor({ timeout: 15_000 });

  await owner.getByRole("link", { name: "Team" }).click();
  await owner.getByText("Meera Joshi").waitFor({ timeout: 10_000 });
  await owner.screenshot({ path: `${evidence}/06-team-owner-desktop.png` });
  const meeraRow = owner.locator("div", { hasText: "Meera Joshi" }).filter({ has: owner.getByRole("button", { name: "Make manager" }) }).last();
  await meeraRow.getByRole("button", { name: "Make manager" }).click();
  await owner.getByRole("button", { name: "Make manager" }).last().click();
  await owner.getByText("Manager", { exact: true }).first().waitFor({ timeout: 10_000 });
  check(true, "the owner makes Meera a manager");

  // the manager reloads and now has Team, without signing in again
  await mgr.reload();
  await mgr.getByRole("link", { name: "Team" }).click({ timeout: 15_000 });
  await mgr.getByText("Ankit Mehta").waitFor({ timeout: 10_000 });
  check(true, "the manager sees the rep on Team");

  // ---- the manager switches the rep off --------------------------------------
  const ankitRow = mgr.locator("div", { hasText: "Ankit Mehta" }).filter({ has: mgr.getByRole("button", { name: "Switch off" }) }).last();
  await ankitRow.getByRole("button", { name: "Switch off" }).click();
  await mgr.getByText("Switch off Ankit Mehta?").waitFor();
  await mgr.screenshot({ path: `${evidence}/07-confirm-switch-off-desktop.png` });
  await mgr.getByRole("button", { name: "Switch off" }).last().click();
  await mgr.getByText("Switch off Ankit Mehta?").waitFor({ state: "hidden" });
  check(true, "the manager switches the rep off");

  // ---- the rep's very next request ------------------------------------------
  await rep.reload();
  await rep.getByText("Sign in", { exact: true }).first().waitFor({ timeout: 15_000 });
  check(true, "the switched-off rep is signed out on their next request");
  await rep.screenshot({ path: `${evidence}/08-rep-signed-out-phone.png` });

  // and cannot sign back in
  await fill(rep, "Mobile number or email", phone(2));
  await fill(rep, "Password", PASSWORD);
  await rep.getByTestId("signin-submit").click();
  await rep.getByText(/switched off by your manager/).waitFor({ timeout: 10_000 });
  check(true, "the switched-off rep cannot sign back in");

  // ---- sign-in page at phone width ------------------------------------------
  const fresh = await context(390, 844);
  await fresh.goto(`${BASE}/sign-in`);
  await fresh.getByTestId("signin-submit").waitFor();
  check((await overflow(fresh)) <= 0, "sign-in has no horizontal overflow on a phone");
  await fresh.screenshot({ path: `${evidence}/09-signin-phone.png` });
  const desk = await context(1366, 860);
  await desk.goto(`${BASE}/sign-in`);
  await desk.getByTestId("signin-submit").waitFor();
  await desk.screenshot({ path: `${evidence}/10-signin-desktop.png` });
} catch (err) {
  for (const [i, p] of (browser.contexts().flatMap((c) => c.pages())).entries()) await p.screenshot({ path: `${evidence}/fail-${i}.png` }).catch(() => {});
  failures.push(err.message.split("\n")[0]);
  console.log("  FAIL", err.message.split("\n")[0]);
} finally {
  await browser.close();
  server.close();
}

check(errors.length === 0, `no console or page errors${errors.length ? `: ${errors.slice(0, 3).join(" | ")}` : ""}`);
console.log(failures.length ? `\n${failures.length} check(s) failed` : "\nPhase 2 gate: all checks passed");
process.exit(failures.length ? 1 : 0);
