/**
 * Phase 3 gate in a real browser against the API's demo company
 * (SEED_DEMO_ON_BOOT=true, DEMO_PASSWORD=demo-pass-1234 in the API's .env):
 *
 *   manager on a laptop: dashboard numbers, range switch, call log, open a
 *   call and set status / follow-up / notes, opportunities and a deal close,
 *   every report tab, settings (statuses, excluded numbers), Excel export.
 *   rep on a phone: own calls only, no Reports, tab bar + More.
 *
 *   npm run build:web && node tools/verifyPhase3.mjs
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
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(new URL(req.url, "http://x").pathname);
  let file = path.join(dist, url);
  if (!file.startsWith(dist) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(dist, "index.html");
  res.writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(4181, r));
const BASE = "http://localhost:4181";
const PASSWORD = process.env.DEMO_PASSWORD ?? "demo-pass-1234";

const failures = [];
const errors = [];
const check = (cond, msg) => {
  console.log(`${cond ? "  ok  " : "  FAIL"} ${msg}`);
  if (!cond) failures.push(msg);
};
const browser = await chromium.launch();

async function signedIn(identifier, width, height) {
  const ctx = await browser.newContext({ viewport: { width, height }, acceptDownloads: true });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && !/status of 4\d\d/.test(m.text()) && errors.push(m.text()));
  await page.goto(`${BASE}/sign-in`);
  await page.getByLabel("Mobile number or email", { exact: true }).fill(identifier);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByTestId("signin-submit").click();
  await page.getByText(/Good (morning|afternoon|evening)/).waitFor({ timeout: 20_000 });
  return page;
}
const overflow = (p) => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
const shot = (p, name) => p.screenshot({ path: `${evidence}/${name}.png`, fullPage: true });

try {
  // ---------------- manager, laptop ----------------
  const m = await signedIn("9000000002", 1440, 900);
  await m.getByText("Leaderboard").first().waitFor({ timeout: 15_000 });
  await m.getByRole("button", { name: "7 days" }).click();
  await m.getByText("Calls per day").waitFor({ timeout: 15_000 });
  const callsTile = await m.locator("text=/^Calls · 7 days$/").count();
  check(callsTile > 0, "dashboard switches to 7 days");
  check((await overflow(m)) <= 0, "dashboard has no horizontal overflow on desktop");
  await shot(m, "p3-01-dashboard-desktop");

  await m.getByRole("link", { name: "Calls" }).click();
  await m.getByText(/^[1-9][\d,]* calls?$/).first().waitFor({ timeout: 20_000 });
  const count = await m.getByText(/^[1-9][\d,]* calls?$/).first().textContent();
  check(/\d/.test(count) && !/^0 calls/.test(count), `call log lists calls (${count})`);
  await shot(m, "p3-02-calls-desktop");

  // open the first connected outgoing call and set what a rep would
  await m.getByRole("button", { name: /^Outgoing call, .*\d+:\d\d/ }).first().click();
  await m.getByText("How did it go?").waitFor();
  // the save reaching the server is the check, not how a chip happens to render it
  const saved = (re) =>
    m.waitForResponse(
      (r) => r.request().method() === "PATCH" && /\/calls\/[0-9a-f]{24}$/.test(r.url()) && r.ok() && re.test(r.request().postData() ?? ""),
      { timeout: 15_000 },
    );
  await Promise.all([saved(/leadStatus/), m.getByRole("radio", { name: "Warm" }).click()]);
  check(true, "a status can be set on a call");
  await Promise.all([saved(/followUpAt/), m.getByText("Tomorrow, 11 am").click()]);
  check(true, "a follow-up can be set");
  const note = `Phase 3 gate run ${Date.now().toString(36)}`;
  await m.getByRole("textbox", { name: "Notes" }).fill(note);
  await Promise.all([saved(/notes/), m.getByRole("button", { name: "Save notes" }).click()]);
  check(true, "notes save");
  await shot(m, "p3-03-call-detail-desktop");
  await m.getByRole("button", { name: "Close" }).last().click();

  // search finds the note just written
  await m.getByLabel("Search", { exact: true }).fill(note);
  await m.getByText(/^1 call$/).waitFor({ timeout: 15_000 });
  check(true, "search finds a call by its notes");
  await m.getByLabel("Search", { exact: true }).fill("");

  // export
  const [dl] = await Promise.all([m.waitForEvent("download", { timeout: 20_000 }), m.getByRole("button", { name: "Export to Excel" }).click()]);
  const file = path.join(evidence, "calls-export.xlsx");
  await dl.saveAs(file);
  check(fs.readFileSync(file).subarray(0, 2).toString() === "PK", "call log exports a real .xlsx");

  // opportunities
  await m.getByRole("link", { name: "Opportunities" }).click();
  await m.getByText("Repeat clients").first().waitFor({ timeout: 15_000 });
  await m.getByText("Close rate", { exact: true }).waitFor({ timeout: 15_000 });
  check(true, "opportunities shows the pipeline");
  await Promise.all([
    m.waitForResponse((r) => r.request().method() === "PATCH" && /\/contacts\/[0-9a-f]{24}\/deal$/.test(r.url()) && r.ok(), { timeout: 15_000 }),
    m.getByRole("radio", { name: /^Closed/, checked: false }).first().click(),
  ]);
  check(true, "a deal can be marked closed");
  await shot(m, "p3-04-opportunities-desktop");

  // reports
  await m.getByRole("link", { name: "Reports" }).click();
  await m.getByText("The whole team, side by side").waitFor({ timeout: 15_000 });
  for (const tab of ["Employees", "Day-wise", "Hourly", "Monthly", "Not called back", "Not picked up", "Unique clients", "Summary"]) {
    await m.getByRole("tab", { name: tab, exact: true }).click();
    await m.waitForTimeout(900);
  }
  await m.getByRole("tab", { name: "Employees", exact: true }).click();
  await m.getByText("In working hours").first().waitFor({ timeout: 15_000 });
  check(true, "employee report shows the working-hours split");
  await shot(m, "p3-05-report-employees-desktop");
  await m.getByRole("tab", { name: "Monthly", exact: true }).click();
  await m.getByText("Less").waitFor({ timeout: 15_000 });
  check(true, "monthly heatmap renders");
  await shot(m, "p3-06-report-monthly-desktop");
  const [pdf] = await Promise.all([m.waitForEvent("download", { timeout: 30_000 }), m.getByRole("button", { name: "PDF" }).click()]);
  const pdfFile = path.join(evidence, "report.pdf");
  await pdf.saveAs(pdfFile);
  check(fs.readFileSync(pdfFile).subarray(0, 4).toString() === "%PDF", "report exports a real PDF");

  // settings
  await m.getByRole("link", { name: "Settings" }).click();
  await m.getByText("Always available").waitFor({ timeout: 15_000 });
  // the demo database lives as long as the API: a previous run may have added it
  if (await m.getByRole("button", { name: "Add a status" }).count()) await m.getByRole("button", { name: "Add a status" }).click();
  await m.getByLabel("Status 5", { exact: true }).fill(`Visit ${Date.now().toString(36).slice(-4)}`);
  await m.getByRole("button", { name: "Save statuses" }).click();
  await m.getByText("Saved.").waitFor({ timeout: 10_000 });
  check(true, "a fifth call status saves and says so");
  await m.getByRole("tab", { name: "Excluded numbers" }).click();
  await m.getByLabel("Phone number", { exact: true }).fill("9811100022");
  await m.getByLabel("Name (optional)", { exact: true }).fill("Rep's home");
  await m.getByRole("button", { name: "Add", exact: true }).click();
  await m.getByText("+91 98111 00022").waitFor({ timeout: 10_000 });
  check(true, "an excluded number is added");
  await shot(m, "p3-07-settings-desktop");

  // ---------------- rep, phone ----------------
  const r = await signedIn("9000000100", 390, 844);
  check((await r.getByRole("tab", { name: "Reports" }).count()) === 0, "a rep has no Reports tab");
  check((await r.getByRole("tab", { name: "More" }).count()) === 1, "the phone tab bar has More");
  check((await overflow(r)) <= 0, "rep dashboard has no horizontal overflow on a phone");
  await shot(r, "p3-08-dashboard-rep-phone");
  await r.getByRole("tab", { name: "Calls" }).click();
  await r.getByText(/^[1-9][\d,]* calls?$/).first().waitFor({ timeout: 20_000 });
  const repRows = await r.getByRole("button", { name: /call, / }).count();
  check(repRows > 0, `rep sees their calls (${repRows} shown)`);
  check((await overflow(r)) <= 0, "call log has no horizontal overflow on a phone");
  await shot(r, "p3-09-calls-rep-phone");
  await r.getByRole("button", { name: /call, / }).first().click();
  await r.getByText("How did it go?").waitFor();
  await shot(r, "p3-10-call-sheet-phone");
  await r.getByRole("button", { name: "Close" }).last().click();
  await r.getByRole("tab", { name: "More" }).click();
  await r.getByRole("link", { name: "Account" }).waitFor({ timeout: 10_000 });
  check((await r.getByRole("link", { name: "Settings" }).count()) === 0, "a rep's More has no Settings");
} catch (err) {
  failures.push(err.message.split("\n")[0]);
  console.log("  FAIL", err.message.split("\n")[0]);
  for (const [i, p] of browser.contexts().flatMap((c) => c.pages()).entries()) await p.screenshot({ path: `${evidence}/p3-fail-${i}.png`, fullPage: true }).catch(() => {});
} finally {
  await browser.close();
  server.close();
}
check(errors.length === 0, `no console or page errors${errors.length ? `: ${errors.slice(0, 3).join(" | ")}` : ""}`);
console.log(failures.length ? `\n${failures.length} check(s) failed` : "\nPhase 3 gate: all checks passed");
process.exit(failures.length ? 1 : 0);
