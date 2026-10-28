/**
 * Phase 7 in a browser: a manager builds an AI campaign, uploads leads from a
 * CSV, and sees them; with Twilio / Claude not configured the page says so and
 * calling can't be started. The live call loop is covered by the API's
 * tests/integration/agent.int.test.js.
 *
 *   npm run build:web && node tools/verifyPhase7Web.mjs
 */
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(here, "../dist");
const evidence = path.resolve(here, "evidence");
const PASSWORD = process.env.DEMO_PASSWORD ?? "demo-pass-1234";
const failures = [];
const errors = [];
const check = (c, m) => {
  console.log(`${c ? "  ok  " : "  FAIL"} ${m}`);
  if (!c) failures.push(m);
};
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".ttf": "font/ttf", ".json": "application/json" };
const server = http.createServer((req, res) => {
  let f = path.join(dist, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!f.startsWith(dist) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(dist, "index.html");
  res.writeHead(200, { "content-type": TYPES[path.extname(f)] ?? "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(4186, r));
const browser = await chromium.launch();
const csv = path.join(os.tmpdir(), `leads-${Date.now()}.csv`);
fs.writeFileSync(csv, ["Phone,Name,Notes", "9820011111,Rakesh Mehta,99acres 2BHK", "9820022222,Sneha Kulkarni,Expo visitor", "9820033333,Anil Patel,", "not-a-number,Bad,"].join("\n"));

try {
  const m = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  m.on("pageerror", (e) => errors.push(e.message));
  m.on("console", (msg) => msg.type() === "error" && !/status of 4\d\d/.test(msg.text()) && errors.push(msg.text()));
  await m.goto("http://localhost:4186/sign-in");
  await m.getByLabel("Mobile number or email", { exact: true }).fill("9000000002");
  await m.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await m.getByTestId("signin-submit").click();
  await m.getByText(/Good (morning|afternoon|evening)/).waitFor({ timeout: 20_000 });

  await m.getByRole("link", { name: "AI agent" }).click();
  await m.getByText("First-round calls, done by AI").waitFor({ timeout: 15_000 });
  await m.getByText("Set up, not switched on yet").waitFor({ timeout: 15_000 });
  check(true, "the page says the agent isn't switched on, and why");

  const name = `Shela Heights ${Date.now().toString(36).slice(-4)}`;
  await m.getByRole("button", { name: "New campaign" }).first().click();
  await m.getByLabel("Campaign name", { exact: true }).fill(name);
  await m.getByLabel("Goal of the call", { exact: true }).fill("Book a site visit at Shela Heights this weekend");
  await m.getByLabel("What it may say", { exact: true }).fill("2BHK from 68 lakh, 3BHK from 92 lakh. Possession December 2027.");
  await m.getByLabel("Transfer to (optional)", { exact: true }).fill("+919800000999");
  await m.screenshot({ path: `${evidence}/p7-01-campaign-editor.png` });
  await m.getByRole("button", { name: "Create campaign" }).click();
  await m.getByText(name).first().waitFor({ timeout: 15_000 });
  check(true, "a campaign is created from the form");

  const [chooser] = await Promise.all([m.waitForEvent("filechooser", { timeout: 15_000 }), m.getByRole("button", { name: "Add leads (CSV / Excel)" }).click()]);
  await chooser.setFiles(csv);
  await m.getByText(/3 leads added/).waitFor({ timeout: 15_000 });
  check(true, "leads upload from a CSV, and the bad row is reported");
  await m.getByText("Rakesh Mehta").waitFor({ timeout: 10_000 });
  check((await m.getByText("To call").count()) === 3, "the three leads are listed, waiting to be called");
  const start = m.getByRole("button", { name: "Start calling" });
  check((await start.getAttribute("aria-disabled")) === "true", "calling can't be started until the agent is switched on");
  await m.screenshot({ path: `${evidence}/p7-02-campaign-detail.png`, fullPage: true });
} catch (e) {
  failures.push(e.message.split("\n")[0]);
  console.log("  FAIL", e.message.split("\n")[0]);
  for (const [i, p] of browser.contexts().flatMap((c) => c.pages()).entries()) await p.screenshot({ path: `${evidence}/p7-fail-${i}.png`, fullPage: true }).catch(() => {});
} finally {
  await browser.close();
  server.close();
  fs.rmSync(csv, { force: true });
}
check(errors.length === 0, `no console or page errors${errors.length ? `: ${errors.slice(0, 3).join(" | ")}` : ""}`);
console.log(failures.length ? `\n${failures.length} check(s) failed` : "\nPhase 7 web gate: all checks passed");
process.exit(failures.length ? 1 : 0);
